import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './i/Scripts/config.js';

// إنشاء عميل Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تعريف عناصر واجهة المستخدم
const uiElements = {
  scoreDisplay: document.getElementById('score'),
  userTelegramIdDisplay: document.getElementById('userTelegramId'),
  userTelegramNameDisplay: document.getElementById('userTelegramName'),
  gameContainer: document.getElementById('gameContainer'),
};

// متغيرات اللعبة
let score = 0;
let gameState = { balance: 0 };

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

// إنشاء عنصر ينبثق عشوائيًا
function createRandomElement() {
  const element = document.createElement('div');
  element.classList.add('popup-element');
  element.style.position = 'absolute';
  element.style.width = '50px';
  element.style.height = '50px';
  element.style.backgroundColor = 'gold';
  element.style.borderRadius = '50%';
  element.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

  // تحديد موقع عشوائي على الشاشة
  const x = Math.random() * (window.innerWidth - 50);
  const y = Math.random() * (window.innerHeight - 50);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;

  // إضافة الحدث عند النقر على العنصر
  element.addEventListener('click', () => {
    score++;
    gameState.balance++;
    updateGameState();
    updateUI();
    element.remove();
  });

  uiElements.gameContainer.appendChild(element);

  // إزالة العنصر بعد فترة إذا لم يتم النقر عليه
  setTimeout(() => {
    if (element.parentElement) element.remove();
  }, 3000);
}

// إطلاق العناصر بشكل دوري
function startGame() {
  setInterval(createRandomElement, 1000); // إضافة عنصر جديد كل ثانية
}

// بدء اللعبة عند تحميل الصفحة
window.onload = async function () {
  await fetchUserDataFromTelegram();
  startGame();
};
