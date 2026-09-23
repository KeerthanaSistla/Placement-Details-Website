/* =========================================================
   CONFIGURATION

   Sheet layout (matches your workbook):

   IT   (master, metadata only)
        Row 1 = Company | Row 2 = Role | Row 3 = Stipend | Row 4 = CTC
        Columns start at C

   IT1 / IT2 / IT3   (students, one tab per section)
        Row 1-3 = mirrored metadata (no Role row!)
        Row 4+  = Roll Number | Name | TRUE/FALSE per company
========================================================= */

const SHEET_ID = "1gMLik20lPryuWYmKSk9qU_fPxYcMq31zpTjiJzgze7M";

const META_SHEET = "IT";
const SECTION_SHEETS = ["IT1", "IT2", "IT3"];

const LAST_COL = "BU";      // last company column to read
const LAST_STUDENT_ROW = 200;

let allCompanies = [];


/* =========================================================
   FETCH HELPERS
   - headers=0  -> row numbers never shift (gviz otherwise
                   guesses how many header rows there are)
   - range=...  -> one row at a time, so each request has a
                   uniform cell type. gviz blanks out cells
                   whose type differs from the column's
                   majority type (e.g. "7.5K" in a column that
                   is otherwise TRUE/FALSE).
========================================================= */

function gvizURL(sheet, range) {
    return (
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
        `?tqx=out:json&headers=0` +
        `&sheet=${encodeURIComponent(sheet)}` +
        `&range=${encodeURIComponent(range)}`
    );
}

function parseGoogleResponse(text) {
    const start = text.indexOf("(") + 1;
    const end = text.lastIndexOf(")");

    if (start <= 0 || end <= start) {
        throw new Error("Invalid Google Sheets response.");
    }

    return JSON.parse(text.substring(start, end));
}

async function fetchRows(sheet, range) {
    const response = await fetch(gvizURL(sheet, range));

    if (!response.ok) {
        throw new Error(`Google Sheets returned ${response.status} for ${sheet}`);
    }

    const data = parseGoogleResponse(await response.text());

    if (data.status === "error") {
        const e = (data.errors && data.errors[0]) || {};
        throw new Error(e.detailed_message || e.message || `Could not read ${sheet}`);
    }

    return (data.table && data.table.rows) || [];
}


/* =========================================================
   CELL HELPERS
========================================================= */

function cellText(cell) {
    if (!cell) return "";

    const v = cell.v;

    if (typeof v === "number") return String(v);

    // Dates: gviz sends "Date(2026,8,10)". Use the formatted text.
    if (typeof v === "string" && v.startsWith("Date(")) {
        return String(cell.f ?? "").trim();
    }

    if (v !== null && v !== undefined) return String(v).trim();

    return "";
}

function isChecked(cell) {
    return !!cell && (
        cell.v === true ||
        String(cell.v).trim().toLowerCase() === "true"
    );
}

function normalizeDisplay(value) {
    return String(value || "")
        .replace(/[\u00A0\u200B\uFEFF\u2000-\u200A\u202F\u205F\u3000]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeKey(value) {
    return normalizeDisplay(value).replace(/\s/g, "").toLowerCase();
}


/* =========================================================
   LOAD
========================================================= */

async function loadSheet() {

    const grid = document.getElementById("companyGrid");

    grid.innerHTML = `<div class="loading">Loading placement data...</div>`;

    try {

        // 1. Company metadata from the master "IT" tab (only place with Role)
        const [companyRow, roleRow, stipendRow, ctcRow] = await Promise.all(
            [1, 2, 3, 4].map(r => fetchRows(META_SHEET, `C${r}:${LAST_COL}${r}`))
        );

        const cellsOf = rows => (rows[0] && rows[0].c) || [];

        const companyCells = cellsOf(companyRow);
        const roleCells    = cellsOf(roleRow);
        const stipendCells = cellsOf(stipendRow);
        const ctcCells     = cellsOf(ctcRow);


        // 2. One "offer" per company column. Identical columns
        //    (same name + role + stipend + CTC) are merged; two
        //    different offers from one company (e.g. IBM intern
        //    vs IBM full-time) stay separate.
        const offers = new Map();
        const columnToOffer = new Map();

        for (let i = 0; i < companyCells.length; i++) {

            const name = normalizeDisplay(cellText(companyCells[i]));
            if (!name) continue;

            const role    = normalizeDisplay(cellText(roleCells[i]))    || "—";
            const stipend = normalizeDisplay(cellText(stipendCells[i])) || "—";
            const ctc     = normalizeDisplay(cellText(ctcCells[i]))     || "—";

            const key = [name, role, stipend, ctc].map(normalizeKey).join("|");

            if (!offers.has(key)) {
                offers.set(key, {
                    name, role, stipend, ctc,
                    students: [],
                    seen: new Set()
                });
            }

            columnToOffer.set(i, offers.get(key));
        }


        // 3. Students from IT1 / IT2 / IT3
        const sheets = await Promise.all(
            SECTION_SHEETS.map(s =>
                fetchRows(s, `A4:${LAST_COL}${LAST_STUDENT_ROW}`)
            )
        );

        sheets.forEach((rows, s) => {

            const section = SECTION_SHEETS[s];

            rows.forEach(row => {

                const cells = row.c || [];

                const roll = cellText(cells[0]).replace(/\.0+$/, "");
                const name = normalizeDisplay(cellText(cells[1]));

                // Skips blank rows and the "Total" row at the bottom
                if (!/^\d{6,}$/.test(roll)) return;

                columnToOffer.forEach((offer, i) => {

                    // company column i lives in sheet column i + 2 (A, B are roll/name)
                    if (!isChecked(cells[i + 2])) return;
                    if (offer.seen.has(roll)) return;

                    offer.seen.add(roll);
                    offer.students.push({ roll, name, section });

                });

            });

        });


        allCompanies = Array.from(offers.values())
            .filter(o => o.students.length > 0)
            .map(o => ({
                name: o.name,
                role: o.role,
                stipend: o.stipend,
                ctc: o.ctc,
                students: o.students,
                count: o.students.length
            }))
            .sort(compareCompanies);

        updateDashboardSummary(allCompanies);
        renderCompanies(allCompanies);

    }
    catch (err) {

        console.error(err);

        grid.innerHTML = `
            <div class="error">
                <h3>Unable to load placement data</h3>
                <p>${escapeHTML(err.message)}</p>
            </div>
        `;

    }

}


/* =========================================================
   AMOUNTS
   CTC column: bare numbers (5.5, "18-20") mean LPA.
   Stipend column: "7.5K", "1L", "20k".
========================================================= */

function isPlainLPA(value) {
    return /^\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?$/.test(String(value).trim());
}

function parseAmount(value, bareUnit = 1) {

    if (!value || value === "—") return null;

    const cleaned = String(value)
        .replace(/,/g, "")
        .replace(/[₹$]/g, "")
        .trim()
        .toLowerCase();

    const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(lpa|lakhs?|l|k)?/);

    if (!match) return null;

    let amount = parseFloat(match[1]);

    switch (match[2]) {
        case "lpa":
        case "lakh":
        case "lakhs":
        case "l":  return amount * 100000;
        case "k":  return amount * 1000;
        default:   return amount * bareUnit;
    }

}

const parseCTC     = v => parseAmount(v, 100000);
const parseStipend = v => parseAmount(v, 1);

function displayCTC(value) {
    return value !== "—" && isPlainLPA(value) ? `${value} LPA` : value;
}

function formatAmount(amount) {

    if (amount === null || amount === undefined || Number.isNaN(amount)) {
        return "—";
    }

    if (amount >= 100000) return (amount / 100000).toFixed(2) + " LPA";
    if (amount >= 1000)   return (amount / 1000).toFixed(2) + "K";

    return amount.toFixed(2);

}

function compareCompanies(a, b) {

    const ctcDiff = (parseCTC(b.ctc) ?? 0) - (parseCTC(a.ctc) ?? 0);
    if (ctcDiff !== 0) return ctcDiff;

    return (parseStipend(b.stipend) ?? 0) - (parseStipend(a.stipend) ?? 0);

}


/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

function updateDashboardSummary(companies) {

    // "UBS (1)" and "UBS (2)" count as one company
    const companySet = new Set(
        companies.map(c => normalizeKey(c.name.replace(/\s*\(\d+\)\s*$/, "")))
    );

    const studentSet = new Set();
    companies.forEach(c => c.students.forEach(s => studentSet.add(s.roll)));

    let highest = null;
    let sum = 0;
    let weight = 0;

    companies.forEach(c => {

        const amount = parseCTC(c.ctc);
        if (amount === null) return;

        if (!highest || amount > highest.amount) {
            highest = { amount, display: displayCTC(c.ctc) };
        }

        sum += amount * c.count;
        weight += c.count;

    });

    document.getElementById("totalCompanies").textContent = companySet.size;
    document.getElementById("totalStudents").textContent = studentSet.size;
    document.getElementById("highestCTC").textContent = highest ? highest.display : "—";
    document.getElementById("averageCTC").textContent =
        weight > 0 ? formatAmount(sum / weight) : "—";

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
            ? `
                <div class="students-section">
                    <button class="students-toggle" type="button">
                        <span>Show students</span>
                        <span class="arrow">▼</span>
                    </button>

                    <div class="students-list">
                        ${company.students.map(s => `
                            <div class="student-row">
                                <div class="student-roll">${escapeHTML(s.roll)}</div>
                                <div class="student-name">${escapeHTML(s.name || "—")}</div>
                                <span class="student-section">${escapeHTML(s.section)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `
            : `
                <div class="students-section">
                    <div class="no-students">No students selected</div>
                </div>
            `;

        card.innerHTML = `
            <div class="card-header">
                <h2>${escapeHTML(company.name)}</h2>
                <div class="role">${escapeHTML(company.role)}</div>
            </div>

            <div class="card-body">

                <div class="details">
                    <div class="detail-box detail-ctc">
                        <div class="detail-title">CTC</div>
                        <div class="detail-value">${escapeHTML(displayCTC(company.ctc))}</div>
                    </div>

                    <div class="detail-box">
                        <div class="detail-title">Stipend</div>
                        <div class="detail-value">${escapeHTML(company.stipend)}</div>
                    </div>
                </div>

                <div class="count-box">
                    <span class="count-label">Students selected</span>
                    <span class="count-value">${company.count}</span>
                </div>

                ${studentSection}

            </div>
        `;

        const toggle = card.querySelector(".students-toggle");
        const list = card.querySelector(".students-list");

        if (toggle && list) {
            toggle.addEventListener("click", () => {

                const open = list.classList.contains("show");

                list.classList.toggle("show");
                toggle.classList.toggle("open");

                toggle.querySelector("span:first-child").textContent =
                    open ? "Show students" : "Hide students";

            });
        }

        grid.appendChild(card);

    });

}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   SEARCH + SECTION FILTER
   <select> values must be: all | IT1 | IT2 | IT3
========================================================= */

function applySearch() {

    const input = document.getElementById("companySearch");
    const sectionFilter = document.getElementById("sectionFilter");

    if (!input || !sectionFilter) return;

    const query = input.value.trim().toLowerCase();
    const aliases = { A: "IT1", B: "IT2", C: "IT3" };
    const selectedSection = aliases[sectionFilter.value] || sectionFilter.value;

    const filtered = allCompanies
        .map(company => {

            let students = company.students;

            if (selectedSection !== "all") {
                students = students.filter(
                    s => s.section.toUpperCase() === selectedSection.toUpperCase()
                );
            }

            if (query) {

                const companyMatches = company.name.toLowerCase().includes(query);

                // Company name matches -> keep every student in the section
                if (!companyMatches) {
                    students = students.filter(s =>
                        s.name.toLowerCase().includes(query) ||
                        s.roll.toLowerCase().includes(query)
                    );
                }

            }

            if (students.length === 0) return null;

            return { ...company, students, count: students.length };

        })
        .filter(Boolean);

    if (filtered.length === 0) {

        const sectionText = selectedSection !== "all" ? ` in ${selectedSection}` : "";

        const message = query
            ? `No company, student or roll number matches "${escapeHTML(input.value)}"${sectionText}.`
            : `No placement data found${sectionText}.`;

        document.getElementById("companyGrid").innerHTML = `
            <div class="no-data">
                <h3>No results found</h3>
                <p>${message}</p>
            </div>
        `;

        return;

    }

    renderCompanies(filtered);

}


/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("companySearch");
    const sectionFilter = document.getElementById("sectionFilter");

    if (input) input.addEventListener("input", applySearch);
    if (sectionFilter) sectionFilter.addEventListener("change", applySearch);

});

loadSheet();