// App strings are separate from program output and the diagnostics language.
const messages = {
  en: {
    brandName: 'Balkh',
    heroDescription: 'Write and run Balkh in your browser. Nothing to install.',
    chooseLanguage: 'Interface language', home: 'Balkh playground home', repository: 'GitHub repository',
    workspace: 'Balkh coding workspace', source: 'Source', results: 'Results', example: 'Example',
    fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen', toggleResults: 'Toggle Results (Ctrl+J / Ctrl+`)',
    fullscreenTitle: 'Expand the editor to fill the browser tab', exitFullscreenTitle: 'Return to the regular workspace',
    resizeResults: 'Resize Results',
    maximize: 'Maximize', restore: 'Restore',
    maximizeResults: 'Maximize the Results panel', restoreResults: 'Restore the docked Results panel',
    loadingExamples: 'Loading examples…', yourProgram: 'Your program', examplesUnavailable: 'Examples unavailable',
    exampleHello: 'Hello, Balkh', exampleStdlib: 'Math & dates', exampleGame: 'Guessing game',
    directionTitle: 'Switch the source editor between RTL and LTR', download: 'Download', downloadTitle: 'Download your Balkh source',
    renameFileTitle: 'Double-click to rename the file', fileName: 'File name', invalidFileName: 'Enter a valid file name.',
    filenameTooLong: 'Use at most {max} characters, including .blk.',
    sourceEditor: 'Balkh source editor', preparingEditor: 'Preparing the editor…', supportedLanguages: 'Dari + Pashto + Python',
    savedAsYouType: 'Saved locally as you type', saved: 'Saved in this browser', saving: 'Saving…',
    saveUnavailable: 'Local saving unavailable · download to keep your code', fallbackEditor: 'Basic editor · syntax highlighting unavailable',
    clear: 'Clear',
    placeholder: 'A little code. A new possibility.', placeholderHint: 'Run your program to see its output here.',
    programOutput: 'Program output',
    noRuns: 'No program run yet', errors: 'Error messages', dari: 'Dari', pashto: 'Pashto',
    toRun: 'to run', stop: 'Stop', run: 'Run code', running: 'Running…',
    runTitle: 'Run your program (Ctrl+Enter / Cmd+Enter)',
    stopTitle: 'Stop the running program (Ctrl+Shift+Enter / Cmd+Shift+Enter)',
    inputLabel: 'Your answer', sendInput: 'Send', endInput: 'End input', waitingInput: 'Waiting for input…',
    inputHelp: 'Press Enter to send. End input signals that there are no more answers.',
    inputUnsupported: 'Interactive input is unavailable in this browser. Try a current version of Chrome or Edge.',
    inputPlaceholder: 'Type your answer…',
    retry: 'Retry', runtimeLoading: 'Loading the Python runtime…', runtimeReady: 'Python is ready', runtimeFailed: 'Python could not start',
    loadingNote: 'The first visit downloads Python. Your code stays in this browser.',
    readyNote: 'Your code runs locally. Each run starts with fresh variables.',
    failedNote: 'Check your connection and retry. Your source is kept here.', runtimeUnavailable: 'Runtime unavailable',
    timeout: 'Loading timed out. Python needs a working connection to its runtime CDN. Please retry.',
    workerStopped: 'The Python worker stopped unexpectedly. Please retry.', unreadableResponse: 'The Python worker returned an unreadable response. Please retry.',
    runtimeLoadError: 'The Python runtime could not be loaded. Please retry.', requestFailed: 'The request failed.',
    outputLimit: '[Output limit reached. Stop the program if it keeps running.]', noOutput: 'Program finished with no output.', programFailed: 'Program failed.',
    finished: 'Finished successfully', finishedError: 'Finished with an error',
    runtimeRunning: 'Running your program…',
    programStopped: '[Program stopped.]', restarting: 'Stopped · starting a fresh Python session',
  },
  dari: {
    brandName: 'بلخ',
    heroDescription: 'کود بلخ را در مرورگر خود بنویسید و اجرا کنید. نیازی به نصب نیست.',
    chooseLanguage: 'زبان رابط', home: 'خانهٔ محیط بلخ', repository: 'مخزن گیت‌هاب',
    workspace: 'محیط کودنویسی بلخ', source: 'کود', results: 'نتیجه‌ها', example: 'نمونه',
    fullscreen: 'تمام‌صفحه', exitFullscreen: 'خروج از تمام‌صفحه', toggleResults: 'نمایش یا پنهان کردن نتیجه‌ها (Ctrl+J / Ctrl+`)',
    fullscreenTitle: 'گسترش ویرایشگر در سراسر زبانهٔ مرورگر', exitFullscreenTitle: 'بازگشت به نمای عادی محیط کودنویسی',
    resizeResults: 'تغییر اندازهٔ نتیجه‌ها',
    maximize: 'بزرگ کردن', restore: 'بازگرداندن',
    maximizeResults: 'بزرگ کردن پنل نتیجه‌ها', restoreResults: 'بازگرداندن پنل نتیجه‌ها به پایین ویرایشگر',
    loadingExamples: 'در حال بارگیری نمونه‌ها…', yourProgram: 'برنامهٔ شما', examplesUnavailable: 'نمونه‌ها در دسترس نیستند',
    exampleHello: 'سلام، بلخ', exampleStdlib: 'ریاضی و تاریخ', exampleGame: 'بازی حدس عدد',
    directionTitle: 'تغییر جهت ویرایشگر میان راست‌به‌چپ و چپ‌به‌راست', download: 'دانلود', downloadTitle: 'دانلود کود بلخ شما',
    renameFileTitle: 'برای تغییر نام فایل، دوبار کلیک کنید', fileName: 'نام فایل', invalidFileName: 'نام معتبری برای فایل وارد کنید.',
    filenameTooLong: 'نام فایل با احتساب پسوند .blk باید حداکثر {max} نویسه باشد.',
    sourceEditor: 'ویرایشگر کود بلخ', preparingEditor: 'در حال آماده‌سازی ویرایشگر…', supportedLanguages: 'دری + پشتو + پایتون',
    savedAsYouType: 'ذخیرهٔ خودکار هنگام نوشتن', saved: 'در این مرورگر ذخیره شد', saving: 'در حال ذخیره…',
    saveUnavailable: 'ذخیرهٔ محلی ممکن نیست؛ برای نگه‌داشتن کود، آن را دانلود کنید', fallbackEditor: 'ویرایشگر ساده؛ رنگ‌آمیزی کود در دسترس نیست',
    clear: 'پاک کردن',
    placeholder: 'کمی کود. یک امکان تازه.', placeholderHint: 'برنامه را اجرا کنید تا خروجی آن این‌جا نمایش داده شود.',
    programOutput: 'خروجی برنامه',
    noRuns: 'هنوز برنامه‌ای اجرا نشده است', errors: 'پیام‌های خطا', dari: 'دری', pashto: 'پشتو',
    toRun: 'برای اجرا', stop: 'توقف', run: 'اجرای کود', running: 'در حال اجرا…',
    runTitle: 'اجرای برنامهٔ شما (Ctrl+Enter / Cmd+Enter)',
    stopTitle: 'توقف برنامهٔ در حال اجرا (Ctrl+Shift+Enter / Cmd+Shift+Enter)',
    inputLabel: 'پاسخ شما', sendInput: 'فرستادن', endInput: 'پایان ورودی', waitingInput: 'در انتظار ورودی…',
    inputHelp: 'برای فرستادن، Enter را بزنید. «پایان ورودی» یعنی پاسخ دیگری ندارید.',
    inputUnsupported: 'ورودی تعاملی در این مرورگر در دسترس نیست. نسخهٔ تازهٔ کروم یا اج را امتحان کنید.',
    inputPlaceholder: 'پاسخ خود را بنویسید…',
    retry: 'تلاش دوباره', runtimeLoading: 'در حال بارگیری محیط اجرای پایتون…', runtimeReady: 'پایتون آماده است', runtimeFailed: 'پایتون راه‌اندازی نشد',
    loadingNote: 'در نخستین بازدید، پایتون دانلود می‌شود. کود شما در این مرورگر می‌ماند.',
    readyNote: 'کود روی دستگاه شما اجرا می‌شود. هر اجرا با متغیرهای تازه آغاز می‌شود.',
    failedNote: 'اتصال اینترنت را بررسی و دوباره تلاش کنید. کود شما این‌جا محفوظ است.', runtimeUnavailable: 'محیط اجرا در دسترس نیست',
    timeout: 'مهلت بارگیری پایان یافت. برای دریافت محیط پایتون، اتصال اینترنت لازم است. دوباره تلاش کنید.',
    workerStopped: 'پردازش پایتون به‌طور غیرمنتظره متوقف شد. دوباره تلاش کنید.', unreadableResponse: 'پاسخ پردازش پایتون قابل خواندن نبود. دوباره تلاش کنید.',
    runtimeLoadError: 'محیط اجرای پایتون بارگیری نشد. دوباره تلاش کنید.', requestFailed: 'درخواست انجام نشد.',
    outputLimit: '[خروجی به حد مجاز رسید. اگر برنامه هنوز اجرا می‌شود، آن را متوقف کنید.]', noOutput: 'برنامه بدون خروجی پایان یافت.', programFailed: 'برنامه با خطا پایان یافت.',
    finished: 'با موفقیت پایان یافت', finishedError: 'با خطا پایان یافت',
    runtimeRunning: 'در حال اجرای برنامهٔ شما…',
    programStopped: '[برنامه متوقف شد.]', restarting: 'متوقف شد؛ در حال راه‌اندازی نشست تازهٔ پایتون',
  },
  pashto: {
    brandName: 'بلخ',
    heroDescription: 'د بلخ کوډ په خپل براوزر کې ولیکئ او وچلوئ. نصب ته اړتیا نشته.',
    chooseLanguage: 'د مخ ژبه', home: 'د بلخ د کوډ چاپېریال کورپاڼه', repository: 'د ګیټ‌هاب زېرمتون',
    workspace: 'د بلخ د کوډ لیکلو چاپېریال', source: 'کوډ', results: 'پایلې', example: 'بېلګه',
    fullscreen: 'بشپړه پرده', exitFullscreen: 'له بشپړې پردې وتل', toggleResults: 'پایلې ښودل یا پټول (Ctrl+J / Ctrl+`)',
    fullscreenTitle: 'سمونګر داسې پراخ کړئ چې د براوزر ټب ډک کړي', exitFullscreenTitle: 'د کوډ لیکلو عادي چاپېریال ته بېرته لاړ شئ',
    resizeResults: 'د پایلو اندازه بدل کړئ',
    maximize: 'لوی کړئ', restore: 'بېرته راوړئ',
    maximizeResults: 'د پایلو پینل لوی کړئ', restoreResults: 'د پایلو پینل د سمونګر لاندې بېرته راوړئ',
    loadingExamples: 'بېلګې بارېږي…', yourProgram: 'ستاسو پروګرام', examplesUnavailable: 'بېلګې نشته',
    exampleHello: 'سلام، بلخ', exampleStdlib: 'ریاضي او نېټې', exampleGame: 'د شمېرې اټکل لوبه',
    directionTitle: 'د سمونګر لوری د ښي نه چپ او د چپ نه ښي ترمنځ بدل کړئ', download: 'ښکته کول', downloadTitle: 'خپل د بلخ کوډ ښکته کړئ',
    renameFileTitle: 'د دوتنې نوم بدلولو لپاره دوه ځله کلیک وکړئ', fileName: 'د دوتنې نوم', invalidFileName: 'د دوتنې سم نوم ولیکئ.',
    filenameTooLong: 'د دوتنې نوم له .blk پسوند سره تر {max} تورو پورې کېدای شي.',
    sourceEditor: 'د بلخ کوډ سمونګر', preparingEditor: 'سمونګر چمتو کېږي…', supportedLanguages: 'دري + پښتو + پایټن',
    savedAsYouType: 'د لیکلو پر مهال په خپله خوندي کېږي', saved: 'په دې براوزر کې خوندي شو', saving: 'خوندي کېږي…',
    saveUnavailable: 'ځايي خوندي کول ممکن نه دي؛ د کوډ د ساتلو لپاره یې ښکته کړئ', fallbackEditor: 'ساده سمونګر؛ د کوډ رنګول نشته',
    clear: 'پاکول',
    placeholder: 'لږ کوډ. یو نوی امکان.', placeholderHint: 'خپل پروګرام وچلوئ، پایله به یې دلته ښکاره شي.',
    programOutput: 'د پروګرام وتۍ',
    noRuns: 'تر اوسه پروګرام نه دی چلول شوی', errors: 'د تېروتنو پیغامونه', dari: 'دري', pashto: 'پښتو',
    toRun: 'د چلولو لپاره', stop: 'درول', run: 'کوډ چلول', running: 'چلېږي…',
    runTitle: 'خپل پروګرام وچلوئ (Ctrl+Enter / Cmd+Enter)',
    stopTitle: 'روان پروګرام ودروئ (Ctrl+Shift+Enter / Cmd+Shift+Enter)',
    inputLabel: 'ستاسو ځواب', sendInput: 'لېږل', endInput: 'د ننوتۍ پای', waitingInput: 'ننوتۍ ته په تمه…',
    inputHelp: 'د لېږلو لپاره Enter ووهئ. «د ننوتۍ پای» یعنې نور ځوابونه نه لرئ.',
    inputUnsupported: 'تعاملي ننوتۍ په دې براوزر کې نشته. د کروم یا اېج نوې نسخه وازمویئ.',
    inputPlaceholder: 'خپل ځواب ولیکئ…',
    retry: 'بیا هڅه', runtimeLoading: 'د پایټن د چلولو چاپېریال بارېږي…', runtimeReady: 'پایټن چمتو دی', runtimeFailed: 'پایټن پیل نه شو',
    loadingNote: 'په لومړي ځل پایټن ښکته کېږي. ستاسو کوډ په دې براوزر کې پاتې کېږي.',
    readyNote: 'کوډ ستاسو په وسیله چلېږي. هر ځل له نویو متغیرونو سره پیل کېږي.',
    failedNote: 'خپل انټرنېټ وګورئ او بیا هڅه وکړئ. ستاسو کوډ دلته خوندي دی.', runtimeUnavailable: 'د چلولو چاپېریال نشته',
    timeout: 'د بارولو وخت پای ته ورسېد. د پایټن د چاپېریال د ترلاسه کولو لپاره انټرنېټ ته اړتیا ده. بیا هڅه وکړئ.',
    workerStopped: 'د پایټن بهیر ناڅاپه ودرېد. بیا هڅه وکړئ.', unreadableResponse: 'د پایټن د بهیر ځواب د لوستلو وړ نه و. بیا هڅه وکړئ.',
    runtimeLoadError: 'د پایټن د چلولو چاپېریال بار نه شو. بیا هڅه وکړئ.', requestFailed: 'غوښتنه ترسره نه شوه.',
    outputLimit: '[وتۍ ټاکلي حد ته ورسېده. که پروګرام لا چلېږي، ویې دروئ.]', noOutput: 'پروګرام له وتۍ پرته پای ته ورسېد.', programFailed: 'پروګرام له تېروتنې سره پای ته ورسېد.',
    finished: 'په بریالیتوب پای ته ورسېد', finishedError: 'له تېروتنې سره پای ته ورسېد',
    runtimeRunning: 'ستاسو پروګرام چلېږي…',
    programStopped: '[پروګرام ودرول شو.]', restarting: 'ودرول شو؛ د پایټن نوې ناسته پیلېږي',
  },
};

export const languageNames = { en: 'English', dari: 'دری', pashto: 'پښتو' };
let currentLanguage = 'en';

export function t(key) { return messages[currentLanguage][key] ?? messages.en[key] ?? key; }

// Keep message keys on elements so changing language also updates current status.
export function setText(id, key) {
  const element = document.getElementById(id);
  element.dataset.i18n = key;
  element.textContent = t(key);
}

export function setLiteralText(id, value) {
  const element = document.getElementById(id);
  delete element.dataset.i18n;
  element.textContent = value;
}

export function applyLanguage(language) {
  currentLanguage = Object.hasOwn(languageNames, language) ? language : 'en';
  document.documentElement.lang = { en: 'en', dari: 'fa-AF', pashto: 'ps-AF' }[currentLanguage];
  document.documentElement.dir = currentLanguage === 'en' ? 'ltr' : 'rtl';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const attribute of ['title', 'aria-label', 'placeholder']) {
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
  document.getElementById('ui-language-label').textContent = languageNames[currentLanguage];
  document.getElementById('ui-language-toggle').setAttribute('aria-label', `${t('chooseLanguage')}: ${languageNames[currentLanguage]}`);
  for (const button of document.querySelectorAll('[data-ui-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.uiLanguage === currentLanguage));
  }
  return currentLanguage;
}
