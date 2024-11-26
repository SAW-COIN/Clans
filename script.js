import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

// إنشاء عميل Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
  scoreDisplay: document.getElementById('score'),
  userTelegramIdDisplay: document.getElementById('userTelegramId'),
  userTelegramNameDisplay: document.getElementById('userTelegramName'),
};

// متغيرات اللعبة
let score = 0;
let swipeActive = false;
let gameState = { balance: 0 };

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
    const { error } = await supabase
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

// التعامل مع السحب
function handleSwipe(event) {
  if (!swipeActive) {
    swipeActive = true;
    score++;
    gameState.balance++;
    updateGameState();
    updateUI();
    setTimeout(() => (swipeActive = false), 100); // السماح بالسحب كل 100ms لتوفير سلاسة أكبر
  }
}

// إضافة مستمع أحداث للسحب
window.addEventListener('touchmove', handleSwipe);

// بدء اللعبة عند تحميل الصفحة
window.onload = async function () {
  await fetchUserDataFromTelegram();
};

