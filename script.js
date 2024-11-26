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
let timeLeft = 60;
let gameOver = false;
let activeTouches = false; // للتحقق إذا كان السحب نشطًا
let gameState = {
  balance: 0,
  lastPlayDate: null,
};
let userTelegramId = null;

// تعطيل التأثيرات الافتراضية للمس
window.addEventListener('touchstart', (event) => event.preventDefault());

// تتبع لمس الشاشة
document.body.addEventListener('touchmove', handleSwipe);
document.body.addEventListener('touchend', () => (activeTouches = false));

//

// تحسين حركة السحب والجمع
function handleSwipe(event) {
  if (gameOver) return;

  activeTouches = true;

  const touch = event.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;

  // تحديد العناصر التي تتلامس مع مسار السحب (إضافة مساحة مرنة)
  const elements = document.elementsFromPoint(x, y);

  elements.forEach((el) => {
    if (el.classList.contains('fallingItem')) {
      // إضافة تأثير جمالي قبل الإزالة
      collectItemEffect(el);

      // إزالة العنصر بعد التأثير
      setTimeout(() => el.remove(), 300);

      // تحديث النقاط
      score++;
      updateUI();
    }
  });
}

// تأثير الجمع (تصغير واختفاء)
function collectItemEffect(element) {
  element.style.transition = 'transform 0.3s, opacity 0.3s';
  element.style.transform = 'scale(0)';
  element.style.opacity = '0';
}

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
      if (timeLeft <= 0) {
        clearInterval(gameTimer);
        endGame();
      }
    }
  }, 1000);

  // بدء إنشاء العناصر المتساقطة
  setTimeout(() => createRandomItem(), 200);
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

  // تصميم العنصر
  item.style.width = '40px';
  item.style.height = '40px';
  item.style.background = 'radial-gradient(circle, #fff, #1a1a1a)';
  item.style.borderRadius = '50%';
  item.style.position = 'absolute';

  document.body.appendChild(item);

  const falling = setInterval(() => {
    if (!gameOver) {
      item.style.top = `${item.offsetTop + 5}px`;
      if (item.offsetTop > window.innerHeight - 10) {
        item.remove();
        clearInterval(falling);
      }
    }
  }, 30);

  setTimeout(() => {
    if (!gameOver) createRandomItem();
  }, Math.max(500 - timeLeft * 5, 100));
}

// تحديث واجهة المستخدم
function updateUI() {
  uiElements.scoreDisplay.innerText = `${score}`;
  uiElements.timerDisplay.innerText = `00:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
}

// بدء اللعبة عند الضغط على الزر
uiElements.startButton.addEventListener('click', startGame);

// تحميل البيانات عند فتح الصفحة
window.onload = fetchUserDataFromTelegram;



