import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

// إنشاء عميل Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
  notification: document.getElementById('notification'),
  scoreDisplay: document.getElementById('score'),
  timerDisplay: document.getElementById('timer'),
  retryButton: document.getElementById('retryButton'),
  userTelegramIdDisplay: document.getElementById('userTelegramId'),
  userTelegramNameDisplay: document.getElementById('userTelegramName'),
  dailyTimerDisplay: document.getElementById('dailyTimer'),
  overlay: document.getElementById('overlay')
};

// متغيرات اللعبة
let score = 0;
let timeLeft = 60;
let gameOver = false;
let swipeActive = false;
let gameState = { balance: 0 };
let lastPlayedAt = null;
const oneDayMs = 24 * 60 * 60 * 1000;

// تعطيل التأثيرات الافتراضية للمس
window.addEventListener('touchstart', (event) => event.preventDefault());

// جلب بيانات المستخدم من Telegram
async function fetchUserDataFromTelegram() {
  const telegramApp = window.Telegram.WebApp;
  telegramApp.ready();

  const userTelegramId = telegramApp.initDataUnsafe.user?.id;
  const userTelegramName = telegramApp.initDataUnsafe.user?.username;

  if (!userTelegramId || !userTelegramName) {
    console.error("Failed to fetch Telegram user data.");
    return;
  }

  uiElements.userTelegramIdDisplay.innerText = `ID: ${userTelegramId}`;
  uiElements.userTelegramNameDisplay.innerText = `Username: ${userTelegramName}`;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userTelegramId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user data from Supabase:', error);
      return;
    }

    if (data) {
      gameState = { ...gameState, ...data };
      lastPlayedAt = new Date(data.last_played_at);
      checkDailyGameAvailability();
      updateUI();
    } else {
      await registerNewUser(userTelegramId, userTelegramName);
    }
  } catch (err) {
    console.error('Error while fetching user data:', err);
  }
}

// تسجيل مستخدم جديد
async function registerNewUser(userTelegramId, userTelegramName) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ telegram_id: userTelegramId, username: userTelegramName, balance: 0, last_played_at: null }]);

    if (error) {
      console.error('Error registering new user:', error);
      return;
    }

    gameState = { telegram_id: userTelegramId, username: userTelegramName, balance: 0 };
    updateUI();
  } catch (err) {
    console.error('Unexpected error while registering new user:', err);
  }
}

// التحقق من إمكانية اللعب اليومية
function checkDailyGameAvailability() {
  const now = new Date();
  const timeSinceLastPlay = now - lastPlayedAt;

  if (lastPlayedAt && timeSinceLastPlay < oneDayMs) {
    const timeRemaining = oneDayMs - timeSinceLastPlay;
    startDailyCountdown(timeRemaining);
  } else {
    uiElements.retryButton.style.display = 'block';
  }
}

// بدء عداد اليومي
function startDailyCountdown(timeRemaining) {
  uiElements.overlay.style.display = 'block';
  const interval = setInterval(() => {
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    uiElements.dailyTimerDisplay.innerText = `${hours}h ${minutes}m ${seconds}s`;

    if (timeRemaining <= 0) {
      clearInterval(interval);
      uiElements.retryButton.style.display = 'block';
      uiElements.dailyTimerDisplay.innerText = '';
      uiElements.overlay.style.display = 'none';
    }

    timeRemaining -= 1000;
  }, 1000);
}

// تحديث واجهة المستخدم
function updateUI() {
  uiElements.scoreDisplay.innerText = `${score}`;
  uiElements.timerDisplay.innerText = `00 : ${timeLeft}`;
}

// تحديث بيانات المستخدم في قاعدة البيانات
async function updateGameState() {
  try {
    const { error } = await supabase
      .from('users')
      .update({ balance: gameState.balance, last_played_at: new Date().toISOString() })
      .eq('telegram_id', gameState.telegram_id);

    if (error) {
      console.error('Error updating game state in Supabase:', error.message);
    }
  } catch (err) {
    console.error('Unexpected error while updating game state:', err);
  }
}

// بدء اللعبة
function startGame() {
  gameOver = false;
  score = 0;
  timeLeft = 60;
  swipeActive = false;
  updateUI();

  // عداد الوقت
  const gameInterval = setInterval(() => {
    if (!gameOver) {
      timeLeft--;
      updateUI();
      if (timeLeft <= 0) {
        clearInterval(gameInterval);
        endGame(true);
      }
    }
  }, 1000);

  document.body.addEventListener('touchmove', handleSwipe);
  spawnFallingItems();
}

// إنهاء اللعبة
function endGame(isWin) {
  gameOver = true;
  document.body.removeEventListener('touchmove', handleSwipe);

  if (isWin) {
    gameState.balance += score;
    updateGameState();
    showNotification(`You won! New Balance: ${gameState.balance}`);
  } else {
    showNotification('Game Over! Try again.');
  }

  uiElements.retryButton.style.display = 'block';
}

// التعامل مع السحب
function handleSwipe(event) {
  if (!swipeActive && !gameOver) {
    swipeActive = true;
    score++;
    updateUI();
    setTimeout(() => (swipeActive = false), 300); // السماح بالسحب كل 300ms
  }
}

// عرض إشعار
function showNotification(message) {
  const notification = document.createElement('div');
  notification.classList.add('notification');
  notification.innerText = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ظهور العملات بشكل متساقط
function spawnFallingItems() {
  const gameContainer = document.getElementById('gameContainer');

  const interval = setInterval(() => {
    if (gameOver) {
      clearInterval(interval);
      return;
    }

    const item = document.createElement('div');
    item.classList.add('fallingItem');
    item.style.left = `${Math.random() * 90}vw`;
    gameContainer.appendChild(item);

    item.addEventListener('click', () => {
      score++;
      item.classList.add('dead');
      setTimeout(() => item.remove(), 500);
      updateUI();
    });

    setTimeout(() => {
      if (!item.classList.contains('dead')) {
        item.remove();
      }
    }, 5000);
  }, 1000);
}

// إعادة تشغيل اللعبة
uiElements.retryButton.addEventListener('click', () => {
  uiElements.retryButton.style.display = 'none';
  startGame();
});

// بدء اللعبة عند تحميل الصفحة
window.onload = async function () {
  uiElements.retryButton.style.display = 'none';
  uiElements.overlay.style.display = 'none';
  await fetchUserDataFromTelegram();
};
