const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/emoji.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS emojis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT DEFAULT 'default',
    type TEXT DEFAULT 'static',
    is_custom INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji_id INTEGER NOT NULL,
    user_id TEXT DEFAULT 'default_user',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emoji_id) REFERENCES emojis(id)
  );

  CREATE TABLE IF NOT EXISTS recent_used (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji_id INTEGER NOT NULL,
    user_id TEXT DEFAULT 'default_user',
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emoji_id) REFERENCES emojis(id)
  );

  CREATE INDEX IF NOT EXISTS idx_emojis_category ON emojis(category);
  CREATE INDEX IF NOT EXISTS idx_emojis_name ON emojis(name);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_recent_user ON recent_used(user_id);
`);

const defaultEmojis = [
  { name: '微笑', url: 'https://img.icons8.com/emoji/96/smiling-face-with-open-mouth.png', category: 'default', type: 'static' },
  { name: '大笑', url: 'https://img.icons8.com/emoji/96/grinning-face-with-smiling-eyes.png', category: 'default', type: 'static' },
  { name: '喜欢', url: 'https://img.icons8.com/emoji/96/smiling-face-with-heart-eyes.png', category: 'default', type: 'static' },
  { name: '惊讶', url: 'https://img.icons8.com/emoji/96/astonished-face.png', category: 'default', type: 'static' },
  { name: '思考', url: 'https://img.icons8.com/emoji/96/thinking-face.png', category: 'default', type: 'static' },
  { name: '酷', url: 'https://img.icons8.com/emoji/96/smiling-face-with-sunglasses.png', category: 'default', type: 'static' },
  { name: '哭', url: 'https://img.icons8.com/emoji/96/crying-face.png', category: 'default', type: 'static' },
  { name: '生气', url: 'https://img.icons8.com/emoji/96/angry-face.png', category: 'default', type: 'static' },
  { name: '睡觉', url: 'https://img.icons8.com/emoji/96/sleeping-face.png', category: 'default', type: 'static' },
  { name: '调皮', url: 'https://img.icons8.com/emoji/96/face-with-tongue.png', category: 'default', type: 'static' },
  { name: '热门1', url: 'https://img.icons8.com/emoji/96/fire.png', category: 'hot', type: 'static' },
  { name: '热门2', url: 'https://img.icons8.com/emoji/96/star.png', category: 'hot', type: 'static' },
  { name: '热门3', url: 'https://img.icons8.com/emoji/96/partying-face.png', category: 'hot', type: 'static' },
  { name: '动态1', url: 'https://img.icons8.com/emoji/96/clapping-hands.png', category: 'animated', type: 'animated' },
  { name: '动态2', url: 'https://img.icons8.com/emoji/96/rolling-on-the-floor-laughing.png', category: 'animated', type: 'animated' },
  { name: '表情包1', url: 'https://img.icons8.com/emoji/96/cat-face.png', category: 'pack', type: 'static' },
  { name: '表情包2', url: 'https://img.icons8.com/emoji/96/dog-face.png', category: 'pack', type: 'static' },
  { name: '表情包3', url: 'https://img.icons8.com/emoji/96/panda.png', category: 'pack', type: 'static' }
];

const insertStmt = db.prepare('INSERT OR IGNORE INTO emojis (name, url, category, type) VALUES (?, ?, ?, ?)');
const countStmt = db.prepare('SELECT COUNT(*) as count FROM emojis');
const count = countStmt.get().count;

if (count === 0) {
  defaultEmojis.forEach(emoji => {
    insertStmt.run(emoji.name, emoji.url, emoji.category, emoji.type);
  });
}

module.exports = db;
