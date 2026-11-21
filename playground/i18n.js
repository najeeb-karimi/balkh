// App strings are separate from program output and the diagnostics language.
const messages = {
  en: {
    heroDescription: 'Write and run Balkh in your browser. Nothing to install.',
    chooseLanguage: 'Interface language', home: 'Balkh playground home', repository: 'GitHub repository',
    workspace: 'Balkh coding workspace', source: 'Source', results: 'Results', example: 'Example',
    loadingExamples: 'Loading examples…', yourProgram: 'Your program', examplesUnavailable: 'Examples unavailable',
    exampleHello: 'Hello, Balkh · سلام بلخ', exampleStdlib: 'Math & dates · ریاضی و زمان', exampleGame: 'Guessing game · بازی',
    directionTitle: 'Switch the source editor between RTL and LTR', download: 'Download', downloadTitle: 'Download your Balkh source',
    sourceEditor: 'Balkh source editor', preparingEditor: 'Preparing the editor…', supportedLanguages: 'Dari + Pashto + Python',
    savedAsYouType: 'Saved locally as you type', saved: 'Saved in this browser', saving: 'Saving…',
    saveUnavailable: 'Local saving unavailable · download to keep your code', fallbackEditor: 'Basic editor · syntax highlighting unavailable',
    clear: 'Clear', resultView: 'Result view', output: 'Output', pythonPreview: 'Python preview', readyWhenYouAre: 'Ready when you are',
    placeholder: 'A little code. A new possibility.', placeholderHint: 'Run your program to see its output here.',
    programOutput: 'Program output', pythonNote: 'The Python behind your Balkh code.', generatedPython: 'Generated Python',
    previewHint: 'Select Python preview to translate your code.', previewStale: 'Source changed. Select Python preview again to refresh.',
    noRuns: 'No program run yet', errors: 'Error messages', dari: 'Dari · دری', pashto: 'Pashto · پښتو',
    programInput: 'Program input', toRun: 'to run', stop: 'Stop', run: 'Run code', running: 'Running…',
    inputLabel: 'Input for your program',
    inputHelp: 'For programs that use input() or its Balkh aliases, enter one answer per line before running. Input is consumed from top to bottom.',
    inputPlaceholder: 'One answer per line', help: 'Start with an example, change a word, and make it yours.',
    nothingToInstall: 'Nothing to install.', freshVariables: 'Fresh variables for every run.',
    footer: 'Made for expression. Built on Python.', mit: 'MIT license', thirdParty: 'Third-party licenses',
    retry: 'Retry', runtimeLoading: 'Loading the Python runtime…', runtimeReady: 'Python is ready', runtimeFailed: 'Python could not start',
    loadingNote: 'The first visit downloads Python. Your code stays in this browser.',
    readyNote: 'Your code runs locally. Each run starts with fresh variables.',
    failedNote: 'Check your connection and retry. Your source is kept here.', runtimeUnavailable: 'Runtime unavailable',
    timeout: 'Loading timed out. Python needs a working connection to its runtime CDN. Please retry.',
    workerStopped: 'The Python worker stopped unexpectedly. Please retry.', unreadableResponse: 'The Python worker returned an unreadable response. Please retry.',
    runtimeLoadError: 'The Python runtime could not be loaded. Please retry.', requestFailed: 'The request failed.',
    outputLimit: '[Output limit reached. Stop the program if it keeps running.]', noOutput: 'Program finished with no output.', programFailed: 'Program failed.',
    finished: 'Finished successfully', previewUpdated: 'Python preview updated', finishedError: 'Finished with an error', translationFailed: 'Translation failed',
    runComplete: 'Run complete', translationComplete: 'Translation complete', checkOutput: 'Check the output',
    runningCode: 'Running your code', translating: 'Translating…', runtimeRunning: 'Running your program…', runtimeTranslating: 'Translating your source…',
    programStopped: '[Program stopped.]', translationStopped: '[Translation stopped.]', restarting: 'Stopped · starting a fresh Python session', stopped: 'Stopped',
  },
  dari: {
    heroDescription: 'کود بلخ را در مرورگر خود بنویسید و اجرا کنید. نیازی به نصب نیست.',
    chooseLanguage: 'زبان رابط', home: 'خانهٔ محیط بلخ', repository: 'مخزن گیت‌هاب',
    workspace: 'محیط کودنویسی بلخ', source: 'کود', results: 'نتیجه‌ها', example: 'نمونه',
    loadingExamples: 'در حال بارگیری نمونه‌ها…', yourProgram: 'برنامهٔ شما', examplesUnavailable: 'نمونه‌ها در دسترس نیستند',
    exampleHello: 'سلام، بلخ', exampleStdlib: 'ریاضی و تاریخ', exampleGame: 'بازی حدس عدد',
    directionTitle: 'تغییر جهت ویرایشگر میان راست‌به‌چپ و چپ‌به‌راست', download: 'دانلود', downloadTitle: 'دانلود کود بلخ شما',
    sourceEditor: 'ویرایشگر کود بلخ', preparingEditor: 'در حال آماده‌سازی ویرایشگر…', supportedLanguages: 'دری + پشتو + پایتون',
    savedAsYouType: 'ذخیرهٔ خودکار هنگام نوشتن', saved: 'در این مرورگر ذخیره شد', saving: 'در حال ذخیره…',
    saveUnavailable: 'ذخیرهٔ محلی ممکن نیست؛ برای نگه‌داشتن کود، آن را دانلود کنید', fallbackEditor: 'ویرایشگر ساده؛ رنگ‌آمیزی کود در دسترس نیست',
    clear: 'پاک کردن', resultView: 'نمای نتیجه', output: 'خروجی', pythonPreview: 'پیش‌نمایش پایتون', readyWhenYouAre: 'آمادهٔ اجرای کود شما',
    placeholder: 'کمی کود. یک امکان تازه.', placeholderHint: 'برنامه را اجرا کنید تا خروجی آن این‌جا نمایش داده شود.',
    programOutput: 'خروجی برنامه', pythonNote: 'کود پایتونِ پشت کود بلخ شما.', generatedPython: 'کود پایتون تولیدشده',
    previewHint: 'برای ترجمهٔ کود، پیش‌نمایش پایتون را انتخاب کنید.', previewStale: 'کود تغییر کرده است. برای تازه‌سازی، دوباره پیش‌نمایش پایتون را انتخاب کنید.',
    noRuns: 'هنوز برنامه‌ای اجرا نشده است', errors: 'پیام‌های خطا', dari: 'دری', pashto: 'پشتو',
    programInput: 'ورودی برنامه', toRun: 'برای اجرا', stop: 'توقف', run: 'اجرای کود', running: 'در حال اجرا…',
    inputLabel: 'ورودی برای برنامهٔ شما',
    inputHelp: 'برای برنامه‌هایی که از \u2066input()\u2069 یا معادل‌های بلخ آن استفاده می‌کنند، پیش از اجرا هر پاسخ را در یک خط بنویسید. پاسخ‌ها از بالا به پایین خوانده می‌شوند.',
    inputPlaceholder: 'هر پاسخ در یک خط', help: 'با یک نمونه آغاز کنید، واژه‌ای را تغییر دهید و برنامهٔ خود را بسازید.',
    nothingToInstall: 'نیازی به نصب نیست.', freshVariables: 'متغیرهای تازه در هر اجرا.',
    footer: 'برای بیان اندیشه. ساخته‌شده با پایتون.', mit: 'مجوز MIT', thirdParty: 'مجوزهای اجزای دیگر',
    retry: 'تلاش دوباره', runtimeLoading: 'در حال بارگیری محیط اجرای پایتون…', runtimeReady: 'پایتون آماده است', runtimeFailed: 'پایتون راه‌اندازی نشد',
    loadingNote: 'در نخستین بازدید، پایتون دانلود می‌شود. کود شما در این مرورگر می‌ماند.',
    readyNote: 'کود روی دستگاه شما اجرا می‌شود. هر اجرا با متغیرهای تازه آغاز می‌شود.',
    failedNote: 'اتصال اینترنت را بررسی و دوباره تلاش کنید. کود شما این‌جا محفوظ است.', runtimeUnavailable: 'محیط اجرا در دسترس نیست',
    timeout: 'مهلت بارگیری پایان یافت. برای دریافت محیط پایتون، اتصال اینترنت لازم است. دوباره تلاش کنید.',
    workerStopped: 'پردازش پایتون به‌طور غیرمنتظره متوقف شد. دوباره تلاش کنید.', unreadableResponse: 'پاسخ پردازش پایتون قابل خواندن نبود. دوباره تلاش کنید.',
    runtimeLoadError: 'محیط اجرای پایتون بارگیری نشد. دوباره تلاش کنید.', requestFailed: 'درخواست انجام نشد.',
    outputLimit: '[خروجی به حد مجاز رسید. اگر برنامه هنوز اجرا می‌شود، آن را متوقف کنید.]', noOutput: 'برنامه بدون خروجی پایان یافت.', programFailed: 'برنامه با خطا پایان یافت.',
    finished: 'با موفقیت پایان یافت', previewUpdated: 'پیش‌نمایش پایتون تازه شد', finishedError: 'با خطا پایان یافت', translationFailed: 'ترجمه انجام نشد',
    runComplete: 'اجرا پایان یافت', translationComplete: 'ترجمه پایان یافت', checkOutput: 'خروجی را بررسی کنید',
    runningCode: 'در حال اجرای کود شما', translating: 'در حال ترجمه…', runtimeRunning: 'در حال اجرای برنامهٔ شما…', runtimeTranslating: 'در حال ترجمهٔ کود شما…',
    programStopped: '[برنامه متوقف شد.]', translationStopped: '[ترجمه متوقف شد.]', restarting: 'متوقف شد؛ در حال راه‌اندازی نشست تازهٔ پایتون', stopped: 'متوقف شد',
  },
  pashto: {
    heroDescription: 'د بلخ کوډ په خپل براوزر کې ولیکئ او وچلوئ. نصب ته اړتیا نشته.',
    chooseLanguage: 'د مخ ژبه', home: 'د بلخ د کوډ چاپېریال کورپاڼه', repository: 'د ګیټ‌هاب زېرمتون',
    workspace: 'د بلخ د کوډ لیکلو چاپېریال', source: 'کوډ', results: 'پایلې', example: 'بېلګه',
    loadingExamples: 'بېلګې بارېږي…', yourProgram: 'ستاسو پروګرام', examplesUnavailable: 'بېلګې نشته',
    exampleHello: 'سلام، بلخ', exampleStdlib: 'ریاضي او نېټې', exampleGame: 'د شمېرې اټکل لوبه',
    directionTitle: 'د سمونګر لوری د ښي نه چپ او د چپ نه ښي ترمنځ بدل کړئ', download: 'ښکته کول', downloadTitle: 'خپل د بلخ کوډ ښکته کړئ',
    sourceEditor: 'د بلخ کوډ سمونګر', preparingEditor: 'سمونګر چمتو کېږي…', supportedLanguages: 'دري + پښتو + پایټن',
    savedAsYouType: 'د لیکلو پر مهال په خپله خوندي کېږي', saved: 'په دې براوزر کې خوندي شو', saving: 'خوندي کېږي…',
    saveUnavailable: 'ځايي خوندي کول ممکن نه دي؛ د کوډ د ساتلو لپاره یې ښکته کړئ', fallbackEditor: 'ساده سمونګر؛ د کوډ رنګول نشته',
    clear: 'پاکول', resultView: 'د پایلې لید', output: 'وتۍ', pythonPreview: 'د پایټن مخکتنه', readyWhenYouAre: 'ستاسو د کوډ چلولو ته چمتو',
    placeholder: 'لږ کوډ. یو نوی امکان.', placeholderHint: 'خپل پروګرام وچلوئ، پایله به یې دلته ښکاره شي.',
    programOutput: 'د پروګرام وتۍ', pythonNote: 'ستاسو د بلخ کوډ تر شا د پایټن کوډ.', generatedPython: 'جوړ شوی د پایټن کوډ',
    previewHint: 'د کوډ د ژباړلو لپاره د پایټن مخکتنه وټاکئ.', previewStale: 'کوډ بدل شوی دی. د تازه کولو لپاره بیا د پایټن مخکتنه وټاکئ.',
    noRuns: 'تر اوسه پروګرام نه دی چلول شوی', errors: 'د تېروتنو پیغامونه', dari: 'دري', pashto: 'پښتو',
    programInput: 'د پروګرام ننوتۍ', toRun: 'د چلولو لپاره', stop: 'درول', run: 'کوډ چلول', running: 'چلېږي…',
    inputLabel: 'ستاسو د پروګرام ننوتۍ',
    inputHelp: 'هغه پروګرامونه چې \u2066input()\u2069 یا یې د بلخ برابر نومونه کاروي، تر چلولو مخکې هر ځواب په جلا کرښه ولیکئ. ځوابونه له پورته څخه ښکته لوستل کېږي.',
    inputPlaceholder: 'هر ځواب په جلا کرښه', help: 'له یوې بېلګې پیل وکړئ، یوه کلمه بدله کړئ او خپل پروګرام جوړ کړئ.',
    nothingToInstall: 'نصب ته اړتیا نشته.', freshVariables: 'د هر ځل چلولو لپاره نوي متغیرونه.',
    footer: 'د خپل فکر د بیان لپاره. په پایټن جوړ شوی.', mit: 'د MIT جواز', thirdParty: 'د نورو برخو جوازونه',
    retry: 'بیا هڅه', runtimeLoading: 'د پایټن د چلولو چاپېریال بارېږي…', runtimeReady: 'پایټن چمتو دی', runtimeFailed: 'پایټن پیل نه شو',
    loadingNote: 'په لومړي ځل پایټن ښکته کېږي. ستاسو کوډ په دې براوزر کې پاتې کېږي.',
    readyNote: 'کوډ ستاسو په وسیله چلېږي. هر ځل له نویو متغیرونو سره پیل کېږي.',
    failedNote: 'خپل انټرنېټ وګورئ او بیا هڅه وکړئ. ستاسو کوډ دلته خوندي دی.', runtimeUnavailable: 'د چلولو چاپېریال نشته',
    timeout: 'د بارولو وخت پای ته ورسېد. د پایټن د چاپېریال د ترلاسه کولو لپاره انټرنېټ ته اړتیا ده. بیا هڅه وکړئ.',
    workerStopped: 'د پایټن بهیر ناڅاپه ودرېد. بیا هڅه وکړئ.', unreadableResponse: 'د پایټن د بهیر ځواب د لوستلو وړ نه و. بیا هڅه وکړئ.',
    runtimeLoadError: 'د پایټن د چلولو چاپېریال بار نه شو. بیا هڅه وکړئ.', requestFailed: 'غوښتنه ترسره نه شوه.',
    outputLimit: '[وتۍ ټاکلي حد ته ورسېده. که پروګرام لا چلېږي، ویې دروئ.]', noOutput: 'پروګرام له وتۍ پرته پای ته ورسېد.', programFailed: 'پروګرام له تېروتنې سره پای ته ورسېد.',
    finished: 'په بریالیتوب پای ته ورسېد', previewUpdated: 'د پایټن مخکتنه تازه شوه', finishedError: 'له تېروتنې سره پای ته ورسېد', translationFailed: 'ژباړه ترسره نه شوه',
    runComplete: 'چلول پای ته ورسېدل', translationComplete: 'ژباړه پای ته ورسېده', checkOutput: 'وتۍ وګورئ',
    runningCode: 'ستاسو کوډ چلېږي', translating: 'ژباړل کېږي…', runtimeRunning: 'ستاسو پروګرام چلېږي…', runtimeTranslating: 'ستاسو کوډ ژباړل کېږي…',
    programStopped: '[پروګرام ودرول شو.]', translationStopped: '[ژباړه ودرول شوه.]', restarting: 'ودرول شو؛ د پایټن نوې ناسته پیلېږي', stopped: 'ودرول شو',
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
  if (id === 'python') element.dir = currentLanguage === 'en' ? 'ltr' : 'rtl';
}

export function setLiteralText(id, value) {
  const element = document.getElementById(id);
  delete element.dataset.i18n;
  element.textContent = value;
  if (id === 'python') element.dir = 'ltr';
}

export function applyLanguage(language) {
  currentLanguage = Object.hasOwn(languageNames, language) ? language : 'en';
  document.documentElement.lang = { en: 'en', dari: 'fa-AF', pashto: 'ps-AF' }[currentLanguage];
  document.documentElement.dir = currentLanguage === 'en' ? 'ltr' : 'rtl';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
    if (element.id === 'python') element.dir = currentLanguage === 'en' ? 'ltr' : 'rtl';
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
