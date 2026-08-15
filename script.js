/* =========================================================
   GOOGLE SHEET CONFIGURATION
========================================================= */

const SHEET_ID =
    "1gMLik20lPryuWYmKSk9qU_fPxYcMq31zpTjiJzgze7M";

const SHEET_NAME = "IT";


/* =========================================================
   GOOGLE SHEET URL
========================================================= */

const SHEET_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;


/* =========================================================
   LOAD SHEET
========================================================= */

async function loadSheet() {

    const companyGrid =
        document.getElementById("companyGrid");


    companyGrid.innerHTML = `
        <div class="loading">
            Loading placement data...
        </div>
    `;


    try {

        console.log("Loading sheet...");
        console.log(SHEET_URL);


        /* =================================================
           FETCH GOOGLE SHEET
        ================================================= */

        const response =
            await fetch(SHEET_URL);


        if (!response.ok) {

            throw new Error(
                `Google Sheets returned ${response.status}`
            );

        }


        const text =
            await response.text();


        console.log("Google response:");
        console.log(text);


        /* =================================================
           EXTRACT JSON
        ================================================= */

        const start =
            text.indexOf("(") + 1;

        const end =
            text.lastIndexOf(")");


        if (
            start <= 0 ||
            end <= start
        ) {

            throw new Error(
                "Invalid Google Sheets response."
            );

        }


        const jsonText =
            text.substring(start, end);


        const data =
            JSON.parse(jsonText);


        console.log("Parsed Google data:");
        console.log(data);


        if (
            !data.table ||
            !data.table.cols ||
            !data.table.rows
        ) {

            throw new Error(
                "No table data found."
            );

        }


        /* =================================================
           PROCESS DIRECTLY FROM GOOGLE TABLE
        ================================================= */

        const companies =
            processSheet(data.table);


        console.log(
            "FINAL COMPANIES:",
            companies
        );


        /* =================================================
           RENDER
        ================================================= */

        renderCompanies(companies);

    }


    catch (error) {

        console.error(
            "ERROR:",
            error
        );


        companyGrid.innerHTML = `

            <div class="error">

                <h3>
                    Unable to load placement data
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;

    }

}


/* =========================================================
   PROCESS GOOGLE SHEET
========================================================= */

function processSheet(table) {

    const columns =
        table.cols || [];

    const rows =
        table.rows || [];


    console.log(
        "NUMBER OF COLUMNS:",
        columns.length
    );


    console.log(
        "NUMBER OF STUDENTS:",
        rows.length
    );


    const companies = [];


    /* =====================================================
       GOOGLE GVIZ HAS ALREADY USED ROWS 1-3 AS HEADERS

       Therefore:

       columns[0] = Roll Number
       columns[1] = Name
       columns[2] = Barclays...
       columns[3] = JPMC...
       etc.
    ===================================================== */


    for (
        let columnIndex = 2;
        columnIndex < columns.length;
        columnIndex++
    ) {


        const column =
            columns[columnIndex];


        /* =================================================
           GET LABEL
        ================================================= */

        let label =
            String(
                column.label || ""
            ).trim();


        console.log(
            "COLUMN:",
            columnIndex,
            label
        );


        /*
           Ignore columns with no company name.
        */

        if (!label) {

            continue;

        }


        /* =================================================
           PARSE COMPANY INFORMATION
        ================================================= */

        const company =
            parseCompanyLabel(label);


        /* =================================================
           FIND SELECTED STUDENTS
        ================================================= */

        const selectedStudents = [];


        rows.forEach(row => {

            const cells =
                row.c || [];


            /* ---------------------------------------------
               Roll Number
            --------------------------------------------- */

            const rollCell =
                cells[0];


            const roll =
                getDisplayValue(
                    rollCell
                );


            /* ---------------------------------------------
               Name
            --------------------------------------------- */

            const nameCell =
                cells[1];


            const name =
                getDisplayValue(
                    nameCell
                );


            /*
               Skip empty student rows.
            */

            if (
                !roll &&
                !name
            ) {

                return;

            }


            /* ---------------------------------------------
               Company checkbox
            --------------------------------------------- */

            const companyCell =
                cells[columnIndex];


            const value =
                getCellValue(
                    companyCell
                );


            const selected =
                value === true ||
                String(value)
                    .trim()
                    .toLowerCase() === "true";


            if (selected) {

                selectedStudents.push({

                    roll: roll,

                    name: name

                });

            }

        });


        /* =================================================
           COUNT

           Since Google GViz has consumed the Total row,
           we calculate the count from TRUE values.

           This is equivalent to your Total row.
        ================================================= */

        const count =
            selectedStudents.length;


        /* =================================================
           ADD COMPANY
        ================================================= */

        companies.push({

            name:
                company.name,

            stipend:
                company.stipend,

            ctc:
                company.ctc,

            count:
                count,

            students:
                selectedStudents

        });


        console.log(
            "COMPANY DATA:",
            {
                name: company.name,
                stipend: company.stipend,
                ctc: company.ctc,
                count: count,
                students: selectedStudents
            }
        );

    }


    return companies;

}


/* =========================================================
   PARSE COMPANY LABEL
=========================================================

   Examples from your actual sheet:

   "Barklays 7.5K 5.5L"
   "JPMC 80K"
   "Delloitte 25K"
   "Hartford 40K"
   "Coforge 15K 5.5L"
   "DBS"
   "UBS (1) 1L 16.5L"
   "EA"
   "Loyality Jagurnat 20K"
   "ValueMomentum 40K 6.5L"
   "UBS (2)"
   "Asset Sence"

========================================================= */

function parseCompanyLabel(label) {

    let text =
        label.trim();


    /*
       Split from the END.

       This is important because company names can
       contain spaces.

       Example:

       ValueMomentum 40K 6.5L

       becomes:

       Company = ValueMomentum
       Stipend = 40K
       CTC     = 6.5L
    */


    const tokens =
        text.split(/\s+/);


    let ctc =
        "—";

    let stipend =
        "—";


    /* =====================================================
       FIND MONEY-LIKE VALUES
    ===================================================== */

    const moneyPattern =
        /^\d+(?:\.\d+)?[KkLlMm]$/;


    const moneyIndexes = [];


    tokens.forEach(
        (token, index) => {

            if (
                moneyPattern.test(token)
            ) {

                moneyIndexes.push(index);

            }

        }
    );


    /* =====================================================
       TWO VALUES

       Company + Stipend + CTC
    ===================================================== */

    if (
        moneyIndexes.length >= 2
    ) {

        const ctcIndex =
            moneyIndexes[moneyIndexes.length - 1];


        const stipendIndex =
            moneyIndexes[moneyIndexes.length - 2];


        ctc =
            tokens[ctcIndex];


        stipend =
            tokens[stipendIndex];


        const companyTokens =
            tokens.slice(
                0,
                stipendIndex
            );


        text =
            companyTokens.join(" ");

    }


    /* =====================================================
       ONE VALUE

       Company + Stipend
    ===================================================== */

    else if (
        moneyIndexes.length === 1
    ) {

        const stipendIndex =
            moneyIndexes[0];


        stipend =
            tokens[stipendIndex];


        const companyTokens =
            tokens.slice(
                0,
                stipendIndex
            );


        text =
            companyTokens.join(" ");

    }


    /* =====================================================
       NO VALUES

       Example:

       DBS
       EA
       UBS (2)
       Asset Sence
    ===================================================== */


    return {

        name:
            text || "Unknown Company",

        stipend:
            stipend,

        ctc:
            ctc

    };

}


/* =========================================================
   GET CELL VALUE
========================================================= */

function getCellValue(cell) {

    if (!cell) {

        return "";

    }


    if (
        cell.v !== undefined &&
        cell.v !== null
    ) {

        return cell.v;

    }


    return "";

}


/* =========================================================
   GET DISPLAY VALUE
========================================================= */

function getDisplayValue(cell) {

    if (!cell) {

        return "";

    }


    /*
       For roll numbers, use Google's formatted value.

       This is VERY IMPORTANT because the raw value is:

       1.60123737001E11

       while the formatted value is:

       160123737001
    */

    if (
        cell.f !== undefined &&
        cell.f !== null
    ) {

        return String(cell.f);

    }


    if (
        cell.v !== undefined &&
        cell.v !== null
    ) {

        return String(cell.v);

    }


    return "";

}


/* =========================================================
   RENDER COMPANY CARDS
========================================================= */

/* =========================================================
   RENDER COMPANY CARDS
========================================================= */

function renderCompanies(companies) {

    const companyGrid =
        document.getElementById("companyGrid");

    companyGrid.innerHTML = "";


    /* =====================================================
       NO COMPANIES
    ===================================================== */

    if (companies.length === 0) {

        companyGrid.innerHTML = `

            <div class="no-data">

                <h3>
                    No companies found
                </h3>

            </div>

        `;

        return;
    }


    /* =====================================================
       CREATE COMPANY CARDS
    ===================================================== */

    companies.forEach(company => {

        const card =
            document.createElement("div");

        card.className = "company-card";


        /* =================================================
           STUDENT LIST
        ================================================= */

        let studentSection = "";


        if (company.students.length > 0) {

            studentSection = `

                <div class="students-section">

                    <button
                        class="students-toggle"
                        type="button"
                    >

                        <span>
                            Show Students
                        </span>

                        <span class="arrow">
                            ▼
                        </span>

                    </button>


                    <div class="students-list">

                        ${

                            company.students
                                .map(
                                    (student, index) => `

                                        <div class="student-row">

                                            <div class="student-roll">
                                                ${escapeHTML(student.roll)}
                                            </div>

                                            <div class="student-name">
                                                ${escapeHTML(student.name)}
                                            </div>

                                        </div>

                                    `
                                )
                                .join("")

                        }

                    </div>

                </div>

            `;

        }

        else {

            studentSection = `

                <div class="students-section">

                    <div class="no-students">

                        No students selected

                    </div>

                </div>

            `;

        }


        /* =================================================
           CARD HTML
        ================================================= */

        card.innerHTML = `

            <div class="card-header">

                <h2>
                    ${escapeHTML(company.name)}
                </h2>

            </div>


            <div class="card-body">


                <div class="details">


                    <div class="detail-box">

                        <div class="detail-title">
                            Stipend
                        </div>

                        <div class="detail-value">
                            ${escapeHTML(company.stipend)}
                        </div>

                    </div>


                    <div class="detail-box">

                        <div class="detail-title">
                            CTC
                        </div>

                        <div class="detail-value">
                            ${escapeHTML(company.ctc)}
                        </div>

                    </div>


                </div>


                <div class="count-box">

                    <div class="count-label">
                        Students
                    </div>

                    <div class="count-value">
                        ${company.count}
                    </div>

                </div>


                ${studentSection}


            </div>

        `;


        /* =================================================
           COLLAPSE / EXPAND
        ================================================= */

        const toggle =
            card.querySelector(
                ".students-toggle"
            );


        const studentsList =
            card.querySelector(
                ".students-list"
            );


        if (toggle && studentsList) {

            toggle.addEventListener(
                "click",
                () => {

                    const isOpen =
                        studentsList.classList
                            .contains("show");


                    studentsList.classList.toggle(
                        "show"
                    );


                    toggle.classList.toggle(
                        "open"
                    );


                    const text =
                        toggle.querySelector(
                            "span:first-child"
                        );


                    if (isOpen) {

                        text.textContent =
                            "Show Students";

                    }

                    else {

                        text.textContent =
                            "Hide Students";

                    }

                }
            );

        }


        companyGrid.appendChild(card);

    });

}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   START APPLICATION
========================================================= */

loadSheet();