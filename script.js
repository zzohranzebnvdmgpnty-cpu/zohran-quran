// ========================================
// ZOHRAN QURAN
// ========================================

const API = "https://api.alquran.cloud/v1";
const TAGALOG_API = "https://quranenc.com/api/v1";
const TAGALOG_KEY = "tagalog_rwwad";
const BOOKMARK_KEY = "zohranQuranBookmarks";

let currentSurah = null;
let currentAyahs = [];
let currentJuz = null;
let recognition = null;
let activeMicButton = null;

const surahList = document.getElementById("surahList");
const surahSearch = document.getElementById("surahSearch");
const surahTitle = document.getElementById("surahTitle");
const ayahContainer = document.getElementById("ayahContainer");
const translationSelect = document.getElementById("translationSelect");
const juzList = document.getElementById("juzList");
const bookmarkList = document.getElementById("bookmarkList");


// ========================================
// HELPERS
// ========================================

async function getJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Could not load Quran data.");
    }

    const result = await response.json();
    return result.data ?? result;
}

function normaliseArabic(text) {
    return text
        .normalize("NFD")
        .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/[^\u0621-\u064A\s]/g, "")
        .trim();
}


// ========================================
// DARK AND LIGHT MODE
// ========================================

const themeToggle = document.getElementById("themeToggle");

function setupTheme() {
    const savedTheme = localStorage.getItem("zohranTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();

    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");

        const theme = document.body.classList.contains("dark-mode")
            ? "dark"
            : "light";

        localStorage.setItem("zohranTheme", theme);
        updateThemeButton();
    });
}

function updateThemeButton() {
    themeToggle.textContent =
        document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
}


// ========================================
// SETTINGS
// ========================================

function setupSettings() {
    const settingsButton = document.getElementById("settingsButton");
    const settingsPanel = document.getElementById("settingsPanel");
    const closeSettings = document.getElementById("closeSettings");

    settingsButton.addEventListener("click", () => {
        settingsPanel.classList.toggle("hidden");
    });

    closeSettings.addEventListener("click", () => {
        settingsPanel.classList.add("hidden");
    });

    document.addEventListener("click", event => {
        if (
            !settingsPanel.contains(event.target) &&
            !settingsButton.contains(event.target)
        ) {
            settingsPanel.classList.add("hidden");
        }
    });
}


// ========================================
// LANGUAGE SETTINGS
// ========================================

function setupLanguages() {
    const savedLanguage = localStorage.getItem("zohranLanguage");
    const languageSetting = document.getElementById("languageSettingSelect");

    if (savedLanguage) {
        translationSelect.value = savedLanguage;
    }

    if (languageSetting) {
        languageSetting.value =
            translationSelect.value === "ur.jalandhry" ? "ur" :
            translationSelect.value === TAGALOG_KEY ? "tl" : "en";

        languageSetting.addEventListener("change", () => {
            const languages = {
                en: "en.sahih",
                ur: "ur.jalandhry",
                tl: TAGALOG_KEY
            };

            translationSelect.value = languages[languageSetting.value];

            localStorage.setItem(
                "zohranLanguage",
                translationSelect.value
            );

            reloadCurrentReading();
        });
    }

    translationSelect.addEventListener("change", () => {
        localStorage.setItem("zohranLanguage", translationSelect.value);
        reloadCurrentReading();
    });
}


// ========================================
// LOAD SURAH LIST
// ========================================

async function loadSurahs() {
    try {
        const surahs = await getJSON(`${API}/surah`);

        surahList.innerHTML = "";

        surahs.forEach(surah => {
            const card = document.createElement("div");
            card.className = "surah-card";

            card.innerHTML = `
                <h3>${surah.number}. ${surah.englishName}</h3>
                <p>${surah.name} · ${surah.numberOfAyahs} Ayahs</p>
            `;

            card.addEventListener("click", () => {
                loadSurah(surah.number);
            });

            surahList.appendChild(card);
        });

    } catch (error) {
        surahList.textContent = "Unable to load Surahs. Please refresh.";
        console.error(error);
    }
}


// ========================================
// SEARCH
// ========================================

surahSearch.addEventListener("input", () => {
    const search = surahSearch.value.toLowerCase();

    document.querySelectorAll(".surah-card").forEach(card => {
        card.style.display =
            card.textContent.toLowerCase().includes(search) ? "" : "none";
    });
});


// ========================================
// TAGALOG TRANSLATION
// ========================================

async function getTagalogSurah(number) {
    const url =
        `${TAGALOG_API}/translation/sura/${TAGALOG_KEY}/${number}`;

    const result = await getJSON(url);

    return Array.isArray(result)
        ? result
        : result.result || result.data || [];
}


// ========================================
// LOAD SURAH
// ========================================

async function loadSurah(number, targetAyah = null) {
    try {
        stopPractice();

        ayahContainer.innerHTML = "<p>Loading Quran...</p>";

        currentSurah = number;
        currentJuz = null;

        const edition = translationSelect.value;

        const [arabic, transliteration, audio] = await Promise.all([
            getJSON(`${API}/surah/${number}`),
            getJSON(`${API}/surah/${number}/en.transliteration`),
            getJSON(`${API}/surah/${number}/ar.alafasy`)
        ]);

        let translations = [];

        if (edition === TAGALOG_KEY) {
            translations = await getTagalogSurah(number);
        } else {
            const translated = await getJSON(
                `${API}/surah/${number}/${edition}`
            );

            translations = translated.ayahs;
        }

        currentAyahs = arabic.ayahs.map((ayah, index) => {
            const translated = translations[index];

            return {
                number: ayah.number,
                numberInSurah: ayah.numberInSurah,
                surahNumber: number,
                surahName: arabic.englishName,
                arabic: ayah.text,
                transliteration:
                    transliteration.ayahs[index]?.text || "",
                translation:
                    edition === TAGALOG_KEY
                        ? translated?.translation || ""
                        : translated?.text || "",
                audio: audio.ayahs[index]?.audio || "",
                juz: ayah.juz
            };
        });

        surahTitle.textContent =
            `${arabic.englishName} — ${arabic.name}`;

        renderAyahs(currentAyahs);

        // AUTOMATICALLY OPEN THE QURAN READER
        setTimeout(() => {
            document.getElementById("quranReader").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            if (targetAyah) {
                scrollToAyah(targetAyah);
            }
        }, 200);

    } catch (error) {
        ayahContainer.innerHTML =
            "<p>Sorry, this Surah could not be loaded. Please try again.</p>";

        console.error(error);
    }
}


// ========================================
// DISPLAY AYAH
// ========================================

function renderAyahs(ayahs) {
    ayahContainer.innerHTML = "";

    ayahs.forEach(ayah => {
        const box = document.createElement("div");

        box.className = "ayah";
        box.id = `ayah-${ayah.numberInSurah}`;

        const arabic = document.createElement("div");
        arabic.className = "arabic";

        ayah.arabic.split(/\s+/).forEach((word, index) => {
            const span = document.createElement("span");

            span.className = "arabic-word";
            span.textContent = word + " ";
            span.dataset.wordIndex = index;

            arabic.appendChild(span);
        });

        const transliteration = document.createElement("p");
        transliteration.className = "transliteration";
        transliteration.textContent = ayah.transliteration;

        const translation = document.createElement("p");
        translation.className = "translation";
        translation.textContent = ayah.translation;

        const tools = document.createElement("div");
        tools.className = "ayah-tools";

        // BOOKMARK BUTTON

        const bookmarkButton = document.createElement("button");
        bookmarkButton.className = "bookmark-button";
        bookmarkButton.textContent = "☆ Bookmark";

        bookmarkButton.addEventListener("click", () => {
            addBookmark(ayah);
        });

        // PRACTICE BUTTON

        const practiceButton = document.createElement("button");
        practiceButton.className = "bookmark-button";
        practiceButton.textContent = "🎙️ Practice";

        practiceButton.addEventListener("click", () => {
            startPractice(ayah, box, practiceButton);
        });

        tools.append(bookmarkButton, practiceButton);

        box.append(
            arabic,
            transliteration,
            translation,
            tools
        );

        // AUDIO PLAYER

        if (ayah.audio) {
            const player = document.createElement("audio");

            player.controls = true;
            player.preload = "none";
            player.src = ayah.audio;

            box.appendChild(player);
        }

        ayahContainer.appendChild(box);
    });
}


// ========================================
// BOOKMARKS
// ========================================

function getBookmarks() {
    try {
        return JSON.parse(
            localStorage.getItem(BOOKMARK_KEY)
        ) || [];
    } catch {
        return [];
    }
}

function addBookmark(ayah) {
    const bookmarks = getBookmarks();

    const alreadySaved = bookmarks.some(item =>
        item.surahNumber === ayah.surahNumber &&
        item.ayahNumber === ayah.numberInSurah
    );

    if (alreadySaved) {
        alert("This Ayah is already bookmarked!");
        return;
    }

    bookmarks.push({
        id: `${ayah.surahNumber}-${ayah.numberInSurah}`,
        surahNumber: ayah.surahNumber,
        surahName: ayah.surahName,
        ayahNumber: ayah.numberInSurah,
        arabic: ayah.arabic,
        createdAt: new Date().toLocaleDateString()
    });

    localStorage.setItem(
        BOOKMARK_KEY,
        JSON.stringify(bookmarks)
    );

    alert("Ayah bookmarked successfully!");

    renderBookmarks();
}

function renderBookmarks() {
    const bookmarks = getBookmarks();

    bookmarkList.innerHTML = "";

    if (bookmarks.length === 0) {
        bookmarkList.innerHTML =
            '<p class="empty-bookmarks">You haven\'t saved any bookmarks yet.</p>';

        return;
    }

    bookmarks.forEach(item => {
        const card = document.createElement("div");
        card.className = "bookmark-card";

        const heading = document.createElement("h3");
        heading.textContent =
            `${item.surahName} — Ayah ${item.ayahNumber}`;

        const arabic = document.createElement("p");
        arabic.className = "arabic";
        arabic.textContent = item.arabic;

        const date = document.createElement("p");
        date.textContent = `Saved: ${item.createdAt}`;

        const actions = document.createElement("div");
        actions.className = "bookmark-actions";

        const continueButton = document.createElement("button");
        continueButton.className = "continue-button";
        continueButton.textContent = "Continue Reading";

        continueButton.addEventListener("click", () => {
            loadSurah(item.surahNumber, item.ayahNumber);
        });

        const removeButton = document.createElement("button");
        removeButton.className = "remove-bookmark";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", () => {
            removeBookmark(item.id);
        });

        actions.append(continueButton, removeButton);

        card.append(heading, arabic, date, actions);

        bookmarkList.appendChild(card);
    });
}

function removeBookmark(id) {
    const bookmarks = getBookmarks().filter(item => item.id !== id);

    localStorage.setItem(
        BOOKMARK_KEY,
        JSON.stringify(bookmarks)
    );

    renderBookmarks();
}


// ========================================
// SAVE READING POSITION
// ========================================

document.getElementById("savePositionButton")
    .addEventListener("click", () => {

        if (!currentSurah) {
            alert("Please open a Surah first.");
            return;
        }

        const firstAyah = currentAyahs[0];

        if (firstAyah) {
            addBookmark(firstAyah);
        }
    });


// ========================================
// MICROPHONE PRACTICE
// ========================================

function startPractice(ayah, box, button) {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert(
            "Speech recognition is not supported by this browser. " +
            "Try Chrome or Edge."
        );

        return;
    }

    stopPractice();

    recognition = new SpeechRecognition();

    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = true;

    activeMicButton = button;

    const words = box.querySelectorAll(".arabic-word");

    words.forEach(word => {
        word.classList.remove(
            "word-highlight",
            "word-mistake"
        );
    });

    button.textContent = "🔴 Stop Practice";
    button.classList.add("recording");

    let transcript = box.querySelector(".speech-transcript");

    if (!transcript) {
        transcript = document.createElement("p");
        transcript.className = "speech-transcript";
        box.appendChild(transcript);
    }

    transcript.textContent = "Listening...";

    recognition.onresult = event => {
        let spoken = "";

        for (let i = 0; i < event.results.length; i++) {
            spoken += event.results[i][0].transcript + " ";
        }

        transcript.textContent = `Recognised: ${spoken}`;

        highlightSpokenWords(
            ayah.arabic,
            spoken,
            words
        );
    };

    recognition.onerror = event => {
        transcript.textContent =
            `Microphone message: ${event.error}. Please try again.`;
    };

    recognition.onend = () => {
        button.textContent = "🎙️ Practice";
        button.classList.remove("recording");

        if (activeMicButton === button) {
            activeMicButton = null;
        }

        recognition = null;
    };

    try {
        recognition.start();
    } catch (error) {
        transcript.textContent =
            "Could not start the microphone.";

        stopPractice();
    }
}

function highlightSpokenWords(arabicText, spokenText, wordElements) {
    const expected = normaliseArabic(arabicText).split(/\s+/);
    const spoken = normaliseArabic(spokenText).split(/\s+/);

    wordElements.forEach((element, index) => {
        element.classList.remove(
            "word-highlight",
            "word-mistake"
        );

        if (index < spoken.length) {
            if (expected[index] === spoken[index]) {
                element.classList.add("word-highlight");
            } else {
                element.classList.add("word-mistake");
            }
        }
    });
}

function stopPractice() {
    if (recognition) {
        recognition.stop();
    }

    if (activeMicButton) {
        activeMicButton.textContent = "🎙️ Practice";
        activeMicButton.classList.remove("recording");
    }

    activeMicButton = null;
    recognition = null;
}


// ========================================
// JUZ
// ========================================

function createJuzButtons() {
    juzList.innerHTML = "";

    for (let i = 1; i <= 30; i++) {
        const button = document.createElement("div");

        button.className = "juz-card";
        button.textContent = `Juz ${i}`;

        button.addEventListener("click", () => {
            loadJuz(i);
        });

        juzList.appendChild(button);
    }
}

async function loadJuz(number) {
    try {
        stopPractice();

        ayahContainer.innerHTML = "<p>Loading Juz...</p>";

        currentJuz = number;
        currentSurah = null;

        const edition = translationSelect.value;

        const [arabic, transliteration] = await Promise.all([
            getJSON(`${API}/juz/${number}/quran-uthmani`),
            getJSON(`${API}/juz/${number}/en.transliteration`)
        ]);

        let translations;

        if (edition === TAGALOG_KEY) {
            const surahNumbers = [
                ...new Set(arabic.ayahs.map(a => a.surah.number))
            ];

            const results = await Promise.all(
                surahNumbers.map(getTagalogSurah)
            );

            const tagalogMap = new Map();

            results.flat().forEach(item => {
                tagalogMap.set(
                    `${item.sura || item.surah}:${item.aya}`,
                    item.translation
                );
            });

            translations = arabic.ayahs.map(a =>
                tagalogMap.get(
                    `${a.surah.number}:${a.numberInSurah}`
                ) || ""
            );

        } else {
            const translated = await getJSON(
                `${API}/juz/${number}/${edition}`
            );

            translations = translated.ayahs.map(a => a.text);
        }

        const audioData = await Promise.all(
            arabic.ayahs.map(a =>
                getJSON(`${API}/ayah/${a.number}/ar.alafasy`)
                    .catch(() => null)
            )
        );

        currentAyahs = arabic.ayahs.map((ayah, index) => ({
            number: ayah.number,
            numberInSurah: ayah.numberInSurah,
            surahNumber: ayah.surah.number,
            surahName: ayah.surah.englishName,
            arabic: ayah.text,
            transliteration:
                transliteration.ayahs[index]?.text || "",
            translation: translations[index] || "",
            audio: audioData[index]?.audio || "",
            juz: number
        }));

        surahTitle.textContent = `Juz ${number}`;

        renderAyahs(currentAyahs);

        // AUTOMATICALLY OPEN THE JUZ READER
        setTimeout(() => {
            document.getElementById("quranReader").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 200);

    } catch (error) {
        ayahContainer.innerHTML =
            "<p>Unable to load this Juz. Please try again.</p>";

        console.error(error);
    }
}


// ========================================
// RELOAD CURRENT READING
// ========================================

function reloadCurrentReading() {
    if (currentSurah) {
        loadSurah(currentSurah);
    } else if (currentJuz) {
        loadJuz(currentJuz);
    }
}


// ========================================
// SCROLL TO AYAH
// ========================================

function scrollToAyah(number) {
    setTimeout(() => {
        const target = document.getElementById(`ayah-${number}`);

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }, 500);
}


// ========================================
// START WEBSITE
// ========================================

function startWebsite() {
    setupTheme();
    setupSettings();
    setupLanguages();

    createJuzButtons();
    loadSurahs();
    renderBookmarks();

    const oldPracticeBox =
        document.querySelector(".recitation-box");

    if (oldPracticeBox) {
        oldPracticeBox.style.display = "none";
    }
}

startWebsite();
