const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  }
});

app.get('/api/emojis', (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = 'SELECT * FROM emojis WHERE 1=1';
    const params = [];
    
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = db.prepare(countSql).get(...params);
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const emojis = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: emojis,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/emojis/upload', upload.single('emoji'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }
    
    const { name } = req.body;
    const emojiName = name || path.parse(req.file.originalname).name;
    const url = `/uploads/${req.file.filename}`;
    const isAnimated = req.file.mimetype === 'image/gif' ? 'animated' : 'static';
    
    const stmt = db.prepare('INSERT INTO emojis (name, url, category, type, is_custom) VALUES (?, ?, ?, ?, 1)');
    const result = stmt.run(emojiName, url, 'custom', isAnimated);
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        name: emojiName,
        url,
        category: 'custom',
        type: isAnimated,
        is_custom: 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/favorites', (req, res) => {
  try {
    const userId = req.query.user_id || 'default_user';
    const sql = `
      SELECT e.*, f.sort_order 
      FROM emojis e 
      INNER JOIN favorites f ON e.id = f.emoji_id 
      WHERE f.user_id = ? 
      ORDER BY f.sort_order ASC, f.created_at DESC
    `;
    const favorites = db.prepare(sql).all(userId);
    res.json({ success: true, data: favorites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/favorites', (req, res) => {
  try {
    const { emoji_id, user_id = 'default_user' } = req.body;
    
    const checkStmt = db.prepare('SELECT id FROM favorites WHERE emoji_id = ? AND user_id = ?');
    const existing = checkStmt.get(emoji_id, user_id);
    
    if (existing) {
      return res.status(400).json({ success: false, message: '已经收藏过了' });
    }
    
    const maxOrderStmt = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM favorites WHERE user_id = ?');
    const maxOrder = maxOrderStmt.get(user_id).max_order;
    
    const stmt = db.prepare('INSERT INTO favorites (emoji_id, user_id, sort_order) VALUES (?, ?, ?)');
    stmt.run(emoji_id, user_id, maxOrder + 1);
    
    res.json({ success: true, message: '收藏成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/favorites/:emoji_id', (req, res) => {
  try {
    const { emoji_id } = req.params;
    const userId = req.query.user_id || 'default_user';
    
    const stmt = db.prepare('DELETE FROM favorites WHERE emoji_id = ? AND user_id = ?');
    stmt.run(emoji_id, userId);
    
    res.json({ success: true, message: '取消收藏成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/favorites/sort', (req, res) => {
  try {
    const { orders, user_id = 'default_user' } = req.body;
    
    const updateStmt = db.prepare('UPDATE favorites SET sort_order = ? WHERE emoji_id = ? AND user_id = ?');
    
    orders.forEach((item, index) => {
      updateStmt.run(index + 1, item.emoji_id, user_id);
    });
    
    res.json({ success: true, message: '排序更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/recent', (req, res) => {
  try {
    const userId = req.query.user_id || 'default_user';
    const limit = parseInt(req.query.limit) || 20;
    
    const sql = `
      SELECT e.*, MAX(r.used_at) as last_used
      FROM emojis e 
      INNER JOIN recent_used r ON e.id = r.emoji_id 
      WHERE r.user_id = ? 
      GROUP BY e.id 
      ORDER BY last_used DESC 
      LIMIT ?
    `;
    const recent = db.prepare(sql).all(userId, limit);
    res.json({ success: true, data: recent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/recent', (req, res) => {
  try {
    const { emoji_id, user_id = 'default_user' } = req.body;
    
    const stmt = db.prepare('INSERT INTO recent_used (emoji_id, user_id) VALUES (?, ?)');
    stmt.run(emoji_id, user_id);
    
    const cleanupStmt = db.prepare(`
      DELETE FROM recent_used 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM recent_used 
        WHERE user_id = ? 
        ORDER BY used_at DESC 
        LIMIT 50
      )
    `);
    cleanupStmt.run(user_id, user_id);
    
    res.json({ success: true, message: '记录成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/emojis/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const emojiStmt = db.prepare('SELECT * FROM emojis WHERE id = ? AND is_custom = 1');
    const emoji = emojiStmt.get(id);
    
    if (!emoji) {
      return res.status(404).json({ success: false, message: '表情不存在或不能删除' });
    }
    
    if (emoji.url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', emoji.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    db.prepare('DELETE FROM favorites WHERE emoji_id = ?').run(id);
    db.prepare('DELETE FROM recent_used WHERE emoji_id = ?').run(id);
    db.prepare('DELETE FROM emojis WHERE id = ?').run(id);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const frontendPath = path.join(__dirname, '../../frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
