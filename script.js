import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
  scoreDisplay: document.getElementById('score'),
  timerDisplay: document.getElementById('timer'),
  retryButton: document.getElementById('retryButton'),
  startButton: document.getElementById('startButton'),
  dailyTimer: document.getElementById('dailyTimer'),
  overlay: document.getElementById('overlay'),
};

// متغيرات اللعبة
let score = 0;
let gameState = { balance: 0, lastPlayDate: null };
let isSwiping = false;

// جلب بيانات المستخدم من Supabase
async function fetchUserData() {
  const telegramApp = window.Telegram.WebApp;
  telegramApp.ready();

  const userTelegramId = telegramApp.initDataUnsafe.user?.id;
  if (!userTelegramId) return;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', userTelegramId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user data:', error);
    return;
  }

  if (data) {
    gameState = { ...gameState, ...data.game_state, balance: data.balance };
    checkPlayEligibility();
  } else {
    await registerNewUser(userTelegramId, telegramApp.initDataUnsafe.user.username);
  }
}

// تسجيل مستخدم جديد
async function registerNewUser(telegramId, username) {
  const { error } = await supabase.from('users').insert({
    telegram_id: telegramId,
    username: username,
    balance: 0,
    game_state: { lastPlayDate: null },
  });

  if (error) console.error('Error registering user:', error);
}

// التحقق من أهلية اللعب
function checkPlayEligibility() {
  const today = new Date().toISOString().split('T')[0];
  if (gameState.lastPlayDate === today) {
    showDailyTimer();
  } else {
    uiElements.startButton.style.display = 'block';
  }
}

// بدء اللعبة
function startGame() {
  uiElements.startButton.style.display = 'none';
  uiElements.retryButton.style.display = 'none';
  uiElements.timerDisplay.textContent = '60';
  score = 0;

  const timer = setInterval(() => {
    const timeLeft = parseInt(uiElements.timerDisplay.textContent, 10) - 1;
    uiElements.timerDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timer);
      endGame();
    }
  }, 1000);

  createFallingItems();
}

// إنهاء اللعبة
async function endGame() {
  gameState.balance += score;
  gameState.lastPlayDate = new Date().toISOString().split('T')[0];

  await supabase.from('users').update({
    balance: gameState.balance,
    game_state: gameState,
  }).eq('telegram_id', gameState.telegram_id);

  showDailyTimer();
}

// عرض مؤقت يومي
function showDailyTimer() {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timeLeft = nextDay - now;

  uiElements.overlay.style.display = 'flex';

  const interval = setInterval(() => {
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    uiElements.dailyTimer.textContent = `${hours}h ${minutes}m ${seconds}s`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      uiElements.overlay.style.display = 'none';
      uiElements.startButton.style.display = 'block';
    }
  }, 1000);
}

// إنشاء العناصر المتساقطة
function createFallingItems() {
  setInterval(() => {
    const item = document.createElement('div');
    item.classList.add('falling-item');
    item.style.left = `${Math.random() * window.innerWidth}px`;
    item.style.top = `0px`;

    document.body.appendChild(item);

    let fallInterval = setInterval(() => {
      if (!isSwiping) {
        item.style.top = `${item.offsetTop + 5}px`;

        if (item.offsetTop > window.innerHeight) {
          document.body.removeChild(item);
          clearInterval(fallInterval);
        }
      }
    }, 50);

    item.addEventListener('touchmove', () => {
      if (!isSwiping) {
        isSwiping = true;
        score++;
        uiElements.scoreDisplay.textContent = score;
        item.remove();
        clearInterval(fallInterval);
        setTimeout(() => (isSwiping = false), 100);
      }
    });
  }, 500);
}

// تهيئة اللعبة
async function initGame() {
  await fetchUserData();

  uiElements.startButton.addEventListener('click', startGame);
}

window.onload = initGame;


