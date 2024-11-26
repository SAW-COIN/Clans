import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

// إنشاء عميل Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
  purchaseNotification: document.getElementById('purchaseNotification'),
  scoreDisplay: document.getElementById('score'),
  timerDisplay: document.getElementById('timer'),
  retryButton: document.getElementById('retryButton'),
  userTelegramIdDisplay: document.getElementById('userTelegramId'),
  userTelegramNameDisplay: document.getElementById('userTelegramName'),
};

// متغيرات اللعبة
let score = 0;
let timeLeft = 60;
let gameOver = false;
let gameState = { balance: 0 };
let isSwiping = false;

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
      .insert([{ telegram_id: userTelegramId, username: userTelegramName, balance: 0 }]);

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
      .update({ balance: gameState.balance })
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
  updateUI();

  // عداد الوقت
  setInterval(() => {
    if (!gameOver) {
      timeLeft--;
      updateUI();
      if (timeLeft <= 0) endGame(true);
    }
  }, 1000);

  // إنشاء العناصر المتساقطة
  setInterval(() => {
    if (!gameOver) createRandomItem();
  }, 200);
}

// إنهاء اللعبة
function endGame(isWin) {
  gameOver = true;

  if (isWin) {
    gameState.balance += score;
    updateGameState();
    showNotification('You won! New Balance: ' + gameState.balance);
  } else {
    showNotification('Game Over! Try again.');
  }

  uiElements.retryButton.style.display = 'block';
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

  // التعامل مع السحب بدلاً من النقر
  item.addEventListener('touchmove', (event) => {
    if (!isSwiping) {
      isSwiping = true;
      score++;
      updateUI();
      item.style.transform = 'scale(0.8)';
      setTimeout(() => {
        document.body.removeChild(item);
        clearInterval(falling);
        isSwiping = false;
      }, 100);
    }
  });
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

// إعادة تشغيل اللعبة
uiElements.retryButton.addEventListener('click', () => {
  uiElements.retryButton.style.display = 'none';
  startGame();
});

// بدء اللعبة عند تحميل الصفحة
window.onload = async function () {
  uiElements.retryButton.style.display = 'none';
  await fetchUserDataFromTelegram();
  startGame();
};
