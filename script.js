import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

// إنشاء عميل Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
  purchaseNotification: document.getElementById('purchaseNotification'),
  scoreDisplay: document.getElementById('score'),
  timerDisplay: document.getElementById('timer'),
  startButton: document.getElementById('startButton'),
  retryButton: document.getElementById('retryButton'),
  dailyTimer: document.getElementById('dailyTimer'),
  overlay: document.getElementById('overlay'),
};

// متغيرات اللعبة
let score = 0;
let timeLeft = 50;
let gameOver = false;
let isSwiping = false;
let gameState = {
  balance: 0,
  lastPlayDate: null, // تاريخ آخر لعب
};
let userTelegramId = null;

// تعطيل التأثيرات الافتراضية للمس
window.addEventListener('touchstart', (event) => event.preventDefault());

// جلب بيانات المستخدم من Telegram
async function fetchUserDataFromTelegram() {
  const telegramApp = window.Telegram.WebApp;
  telegramApp.ready();

  userTelegramId = telegramApp.initDataUnsafe.user?.id;

  if (!userTelegramId) {
    console.error("Failed to fetch Telegram user data.");
    return;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userTelegramId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      gameState = { ...gameState, ...data };
      checkDailyPlayAccess();
    } else {
      await registerNewUser(userTelegramId);
    }
  } catch (err) {
    console.error('Error while fetching user data:', err);
  }
}

// تسجيل مستخدم جديد
async function registerNewUser(telegramId) {
  try {
    const { error } = await supabase
      .from('users')
      .insert([{ telegram_id: telegramId, balance: 0, last_play_date: null }]);

    if (error) throw error;
    gameState = { telegram_id: telegramId, balance: 0, lastPlayDate: null };
  } catch (err) {
    console.error('Unexpected error while registering new user:', err);
  }
}

// تحقق من إمكانية اللعب اليوم
function checkDailyPlayAccess() {
  const today = new Date().setHours(0, 0, 0, 0);
  const lastPlay = new Date(gameState.lastPlayDate || 0).setHours(0, 0, 0, 0);

  if (today > lastPlay) {
    uiElements.startButton.style.display = 'block';
    uiElements.overlay.style.display = 'none';
  } else {
    const timeRemaining = calculateTimeToNextDay();
    displayDailyTimer(timeRemaining);
  }
}

// حساب الوقت المتبقي لليوم التالي
function calculateTimeToNextDay() {
  const now = new Date();
  const nextDay = new Date();
  nextDay.setHours(24, 0, 0, 0);
  return Math.floor((nextDay - now) / 1000);
}

// عرض المؤقت اليومي
function displayDailyTimer(seconds) {
  uiElements.overlay.style.display = 'block';
  uiElements.startButton.style.display = 'none';

  const updateTimer = () => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    uiElements.dailyTimer.innerText = `Next game in: ${hours}h ${minutes}m ${secs}s`;

    if (seconds > 0) {
      seconds--;
      setTimeout(updateTimer, 1000);
    } else {
      checkDailyPlayAccess();
    }
  };
  updateTimer();
}

// بدء اللعبة
function startGame() {
  score = 0;
  timeLeft = 60;
  gameOver = false;
  updateUI();

  uiElements.startButton.style.display = 'none';
  uiElements.retryButton.style.display = 'none';

  const gameTimer = setInterval(() => {
    if (gameOver) {
      clearInterval(gameTimer);
    } else {
      timeLeft--;
      updateUI();
      if (timeLeft <= 0) endGame();
    }
  }, 1000);

  setInterval(() => {
    if (!gameOver) createRandomItem();
  }, 200);
}

// إنهاء اللعبة
async function endGame() {
  gameOver = true;
  gameState.balance += score;

  try {
    const { error } = await supabase
      .from('users')
      .update({
        balance: gameState.balance,
        last_play_date: new Date().toISOString(),
      })
      .eq('telegram_id', userTelegramId);

    if (error) throw error;
  } catch (err) {
    console.error('Error updating game state:', err);
  }

  displayDailyTimer(calculateTimeToNextDay());
}

// إنشاء عنصر متساقط عشوائي
function createRandomItem() {
  const item = document.createElement('div');
  item.classList.add('fallingItem');
  item.style.left = `${Math.random() * (window.innerWidth - 50)}px`;
  item.style.top = '-50px';
  document.body.appendChild(item);

  let falling = setInterval(() => {
    if (!gameOver) {
      item.style.top = `${item.offsetTop + 10}px`;
      if (item.offsetTop > window.innerHeight - 10) {
        document.body.removeChild(item);
        clearInterval(falling);
      }
    }
  }, 30);

  item.addEventListener('touchmove', () => {
    if (!isSwiping) {
      isSwiping = true;
      score++;
      updateUI();
      item.remove();
      clearInterval(falling);
      isSwiping = false;
    }
  });
}

// تحديث واجهة المستخدم
function updateUI() {
  uiElements.scoreDisplay.innerText = `${score}`;
  uiElements.timerDisplay.innerText = `00 : ${timeLeft}`;
}

// بدء اللعبة عند الضغط على الزر
uiElements.startButton.addEventListener('click', startGame);

// تحميل البيانات عند فتح الصفحة
window.onload = fetchUserDataFromTelegram;



