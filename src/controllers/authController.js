const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { email, phone, password, role } = req.body;

    // [CRITICAL] 컨트롤러 레벨 role 방어 — admin 직접 가입 차단
    const allowedRoles = ['expert', 'client'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: '허용되지 않는 역할입니다.' });
    }

    const exists = await db('users').where({ email }).first();
    if (exists) {
      return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db('users')
      .insert({ email, phone: phone || null, password_hash, role })
      .returning(['id', 'email', 'role', 'created_at']);

    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 틀렸습니다.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 틀렸습니다.' });
    }

    const token = signToken(user);
    res.json({
      user: { id: user.id, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const user = await db('users')
      .select('id', 'email', 'phone', 'role', 'created_at')
      .where({ id: req.user.id })
      .first();
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
