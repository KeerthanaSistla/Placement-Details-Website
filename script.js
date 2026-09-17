/* =========================================================
   GOOGLE SHEET CONFIGURATION
========================================================= */

const SHEET_ID =
    "1gMLik20lPryuWYmKSk9qU_fPxYcMq31zpTjiJzgze7M";

const SHEET_NAME = "StudentDetails";


/* =========================================================
   GLOBAL STATE
========================================================= */

let allCompanies = [];


/* =========================================================
   MAIN URL
========================================================= */

function getSheetURL() {
    return (
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
        `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`
    );
}


/* =========================================================
   LOAD SHEET
========================================================= */

async function loadSheet() {

    const grid = document.getElementById("companyGrid");

    grid.innerHTML = `<div class="loading">Loading placement data...</div>`;

    try {

        const response = await fetch(getSheetURL());

        if (!response.ok) {
            throw new Error(`Google Sheets returned ${response.status}`);
        }

        const text = await response.text();
        const data = parseGoogleResponse(text);

        if (!data.table || !data.table.rows) {
            throw new Error("No table data found.");
        }

        allCompanies = processSheet(data.table);
        allCompanies.sort(compareCompanies);

        updateDashboardSummary(allCompanies);
        renderCompanies(allCompanies);
    }
    catch (err) {
        console.error(err);
        grid.innerHTML = `
            <div class="error">
                <h3>Unable to load placement data</h3>
                <p>${escapeHTML(err.message)}</p>
            </div>`;
    }
}


/* =========================================================
   PARSE GVIZ RESPONSE
========================================================= */

function parseGoogleResponse(text) {
    const start = text.indexOf("(") + 1;
    const end   = text.lastIndexOf(")");
    if (start <= 0 || end <= start) {
        throw new Error("Invalid Google Sheets response.");
    }
    return JSON.parse(text.substring(start, end));
}


/* =========================================================
   STRING NORMALIZERS
========================================================= */

function normalizeKey(value) {
    return String(value || "")
        .replace(/[\s\u00A0\u200B\uFEFF\u2000-\u200A\u202F\u205F\u3000]/g, "")
        .trim()
        .toLowerCase();
}

function normalizeDisplay(value) {
    return String(value || "")
        .replace(/[\u00A0\u200B\uFEFF\u2000-\u200A\u202F\u205F\u3000]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================================
   GET CELL DISPLAY VALUE
========================================================= */

function getDisplayValue(cell) {
    if (!cell) return "";
    if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
    if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
    return "";
}


/* =========================================================
   BUILD HEADER INDEX MAP (read by header name)
========================================================= */

function buildHeaderIndex(table) {

    const cols = table.cols || [];

    const aliases = {
        roll:    ["roll number", "rollnumber", "roll no", "roll"],
        name:    ["name"],
        company: ["company", "company name"],
        role:    ["role", "role name"],
        stipend: ["stipend"],
        ctc:     ["ctc"]
    };

    const idx = {};

    for (const key of Object.keys(aliases)) {
        idx[key] = -1;
        const wanted = aliases[key];
        for (let c = 0; c < cols.length; c++) {
            const label = normalizeKey(cols[c]?.label || "");
            if (wanted.includes(label)) {
                idx[key] = c;
                break;
            }
        }
    }

    return idx;
}


/* =========================================================
   PROCESS SHEET → GROUP BY COMPANY
========================================================= */

function processSheet(table) {

    const rows = table.rows || [];
    const idx  = buildHeaderIndex(table);

    const COL = {
        roll:    idx.roll    >= 0 ? idx.roll    : 0,
        name:    idx.name    >= 0 ? idx.name    : 1,
        company: idx.company >= 0 ? idx.company : 4,
        role:    idx.role    >= 0 ? idx.role    : 5,
        stipend: idx.stipend >= 0 ? idx.stipend : 7,
        ctc:     idx.ctc     >= 0 ? idx.ctc     : 8
    };

    const companyMap = new Map();

    rows.forEach(row => {

        const cells = row.c || [];

        const roll    = getDisplayValue(cells[COL.roll]);
        const name    = getDisplayValue(cells[COL.name]);
        const company = getDisplayValue(cells[COL.company]);
        const role    = getDisplayValue(cells[COL.role]).trim();
        const stipend = getDisplayValue(cells[COL.stipend]).trim();
        const ctc     = getDisplayValue(cells[COL.ctc]).trim();

        if (normalizeKey(roll) === "rollnumber") return;
        if (!company || !company.trim()) return;
        if (!roll && !name) return;

        const companyKey     = normalizeKey(company);
        const companyDisplay = normalizeDisplay(company);

        if (!companyKey) return;

        if (!companyMap.has(companyKey)) {
            companyMap.set(companyKey, {
                name: companyDisplay,
                role: role || "—",
                stipend: stipend || "—",
                ctc: ctc || "—",
                count: 0,
                students: [],
                _seen: new Set()
            });
        }

        const entry = companyMap.get(companyKey);

        if (entry.role === "—" && role)       entry.role = role;
        if (entry.stipend === "—" && stipend) entry.stipend = stipend;
        if (entry.ctc === "—" && ctc)         entry.ctc = ctc;

        const rollKey = normalizeKey(roll).replace(/\.0+$/, "");
        const dedupeKey = rollKey || normalizeKey(name);

        if (!dedupeKey) return;
        if (entry._seen.has(dedupeKey)) return;

        entry._seen.add(dedupeKey);
        entry.students.push({ roll: rollKey, name });
        entry.count++;
    });

    const companies = Array.from(companyMap.values());
    companies.forEach(c => delete c._seen);
    return companies;
}


/* =========================================================
   NUMERIC PARSING / FORMATTING
========================================================= */

function parseAmount(value) {
    if (!value || value === "—") return null;
    const cleaned = String(value)
        .replace(/,/g, "")
        .replace(/[₹$]/g, "")
        .trim()
        .toLowerCase();
    const match = cleaned.match(/([\d.]+)\s*(lpa|lakh|lakhs|k)?/);
    if (!match) return null;
    let amount = parseFloat(match[1]);
    const unit = match[2];
    if (unit === "lpa" || unit === "lakh" || unit === "lakhs") amount *= 100000;
    else if (unit === "k") amount *= 1000;
    return amount;
}

function formatAmount(amount) {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    if (amount >= 100000) return (amount / 100000).toFixed(2) + " LPA";
    if (amount >= 1000)   return (amount / 1000).toFixed(2) + "K";
    return amount.toFixed(2);
}


/* =========================================================
   SORT
========================================================= */

function compareCompanies(a, b) {
    const ctcA = parseAmount(a.ctc) ?? 0;
    const ctcB = parseAmount(b.ctc) ?? 0;
    if (ctcA !== ctcB) return ctcB - ctcA;
    const stipendA = parseAmount(a.stipend) ?? 0;
    const stipendB = parseAmount(b.stipend) ?? 0;
    return stipendB - stipendA;
}


/* =========================================================
   DASHBOARD SUMMARY (unique counts)
========================================================= */

function updateDashboardSummary(companies) {

    /* Unique companies */
    const companySet = new Set();
    companies.forEach(c => {
        const k = normalizeKey(c.name);
        if (k) companySet.add(k);
    });

    /* Unique students (roll number, deduped) */
    const studentSet = new Set();
    companies.forEach(c => {
        c.students.forEach(s => {
            const rollKey = normalizeKey(s.roll).replace(/\.0+$/, "");
            const nameKey = normalizeKey(s.name);
            const k = rollKey || nameKey;
            if (k) studentSet.add(k);
        });
    });

    /* Highest CTC */
    let highest = null;
    companies.forEach(c => {
        const amt = parseAmount(c.ctc);
        if (amt === null) return;
        if (highest === null || amt > highest.amount) {
            highest = { amount: amt, display: c.ctc };
        }
    });

    /* Student-weighted average CTC */
    let sum = 0, cnt = 0;
    companies.forEach(c => {
        const amt = parseAmount(c.ctc);
        if (amt === null || !c.count) return;
        sum += amt * c.count;
        cnt += c.count;
    });
    const avg = cnt > 0 ? sum / cnt : null;

    document.getElementById("totalCompanies").textContent = companySet.size;
    document.getElementById("totalStudents").textContent  = studentSet.size;
    document.getElementById("highestCTC").textContent     = highest ? highest.display : "—";
    document.getElementById("averageCTC").textContent     = avg !== null ? formatAmount(avg) : "—";
}


/* =========================================================
   RENDER
========================================================= */

function renderCompanies(companies) {

    const grid = document.getElementById("companyGrid");
    grid.innerHTML = "";

    if (companies.length === 0) {
        grid.innerHTML = `<div class="no-data"><h3>No companies found</h3></div>`;
        return;
    }

    companies.forEach(company => {

        const card = document.createElement("div");
        card.className = "company-card";

        const studentSection = company.students.length
            ? `<div class="students-section">
                   <button class="students-toggle" type="button">
                       <span>Show Students</span>
                       <span class="arrow">▼</span>
                   </button>
                   <div class="students-list">
                       ${company.students.map(s => `
                           <div class="student-row">
                               <div class="student-roll">${escapeHTML(s.roll)}</div>
                               <div class="student-name">${escapeHTML(s.name)}</div>
                           </div>`).join("")}
                   </div>
               </div>`
            : `<div class="students-section">
                   <div class="no-students">No students selected</div>
               </div>`;

        card.innerHTML = `
            <div class="card-header"><h2>${escapeHTML(company.name)}</h2></div>
            <div class="card-body">
                <div class="role" style="text-align:center;color:#777;font-size:14px;margin-bottom:18px;">
                    ${escapeHTML(company.role)}
                </div>
                <div class="details">
                    <div class="detail-box">
                        <div class="detail-title">Stipend</div>
                        <div class="detail-value">${escapeHTML(company.stipend)}</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-title">CTC</div>
                        <div class="detail-value">${escapeHTML(company.ctc)}</div>
                    </div>
                </div>
                <div class="count-box">
                    <div class="count-label">Students</div>
                    <div class="count-value">${company.count}</div>
                </div>
                ${studentSection}
            </div>`;

        const toggle = card.querySelector(".students-toggle");
        const list   = card.querySelector(".students-list");
        if (toggle && list) {
            toggle.addEventListener("click", () => {
                const open = list.classList.contains("show");
                list.classList.toggle("show");
                toggle.classList.toggle("open");
                toggle.querySelector("span:first-child").textContent =
                    open ? "Show Students" : "Hide Students";
            });
        }

        grid.appendChild(card);
    });
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   SEARCH
========================================================= */

function applySearch() {

    const input = document.getElementById("companySearch");
    if (!input) return;

    const q = input.value.trim().toLowerCase();

    if (!q) { renderCompanies(allCompanies); return; }

    const filtered = allCompanies.map(company => {
        const cName = String(company.name || "").toLowerCase();
        if (cName.includes(q)) return company;

        const matches = company.students.filter(s =>
            String(s.name || "").toLowerCase().includes(q) ||
            String(s.roll || "").toLowerCase().includes(q)
        );

        if (matches.length) {
            return { ...company, students: matches, count: matches.length };
        }
        return null;
    }).filter(c => c !== null);

    if (!filtered.length) {
        document.getElementById("companyGrid").innerHTML = `
            <div class="no-data">
                <h3>No results found</h3>
                <p>No company, student or roll number matches "${escapeHTML(input.value)}"</p>
            </div>`;
        return;
    }

    renderCompanies(filtered);
}


/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("companySearch");
    if (input) input.addEventListener("input", applySearch);
});

loadSheet();