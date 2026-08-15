/* =========================================================
   GOOGLE SHEET CONFIGURATION
========================================================= */

const SHEET_ID =
    "1gMLik20lPryuWYmKSk9qU_fPxYcMq31zpTjiJzgze7M";

const SHEET_NAME =
    "IT";


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
           EXTRACT JSON FROM GVIZ RESPONSE
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


        console.log(
            "Parsed Google data:",
            data
        );


        /* =================================================
           CHECK DATA
        ================================================= */

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
           PROCESS DATA
        ================================================= */

        const companies =
            processSheet(data.table);


        console.log(
            "FINAL COMPANIES:",
            companies
        );


        /* =================================================
           RENDER CARDS
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


    /*
       Google GViz has interpreted the first three
       rows of the sheet as column information.

       Therefore:

       columns[0] = Roll Number
       columns[1] = Name

       columns[2+] = Companies
    */


    for (
        let columnIndex = 2;
        columnIndex < columns.length;
        columnIndex++
    ) {


        const column =
            columns[columnIndex];


        /* =================================================
           GET COMPANY LABEL
        ================================================= */

        const label =
            String(
                column.label || ""
            ).trim();


        console.log(
            "COLUMN:",
            columnIndex,
            label
        );


        /*
           Ignore completely empty columns.
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
           FIND STUDENTS
        ================================================= */

        const selectedStudents = [];


        rows.forEach(row => {

            const cells =
                row.c || [];


            /* ---------------------------------------------
               ROLL NUMBER
            --------------------------------------------- */

            const roll =
                getDisplayValue(
                    cells[0]
                );


            /* ---------------------------------------------
               STUDENT NAME
            --------------------------------------------- */

            const name =
                getDisplayValue(
                    cells[1]
                );


            /*
               Ignore empty rows.
            */

            if (
                !roll &&
                !name
            ) {

                return;

            }


            /* ---------------------------------------------
               COMPANY VALUE
            --------------------------------------------- */

            const companyCell =
                cells[columnIndex];


            const value =
                getCellValue(
                    companyCell
                );


            /*
               Google checkbox values can be:

               true
               "TRUE"
               false
               "FALSE"
            */

            const selected =
                value === true ||
                String(value)
                    .trim()
                    .toLowerCase() === "true";


            if (selected) {

                selectedStudents.push({

                    roll:
                        roll,

                    name:
                        name

                });

            }

        });


        /* =================================================
           COUNT
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

   Examples:

   Barklays 7.5K 5.5L
   JPMC 80K
   Delloitte 25K
   Hartford 40K
   Coforge 15K 5.5L
   DBS
   UBS (1) 1L 16.5L
   EA
   Loyality Jagurnat 20K
   ValueMomentum 40K 6.5L
   UBS (2)
   Asset Sence

========================================================= */

function parseCompanyLabel(label) {

    let text =
        String(label || "").trim();


    /* =================================================
       MONEY PATTERN

       Supports:

       7.5K
       80K
       25K
       40K
       15K
       5.5L
       1L
       16.5L
       6.5L

    ================================================= */

    const moneyRegex =
        /\d+(?:\.\d+)?\s*[KLMklm]/g;


    /* =================================================
       FIND MONEY VALUES
    ================================================= */

    const matches =
        text.match(moneyRegex) || [];


    /* =================================================
       NORMALIZE VALUES
    ================================================= */

    const values =
        matches.map(value => {

            return value
                .replace(/\s+/g, "")
                .toUpperCase();

        });


    /* =================================================
       REMOVE MONEY FROM COMPANY NAME
    ================================================= */

    let companyName =
        text.replace(
            moneyRegex,
            ""
        );


    companyName =
        companyName
            .replace(/\s+/g, " ")
            .trim();


    /* =================================================
       DEFAULT VALUES
    ================================================= */

    let stipend =
        "—";

    let ctc =
        "—";


    /* =================================================
       ONE MONEY VALUE

       Example:

       JPMC 80K

       Company:
       JPMC

       Stipend:
       80K

       CTC:
       —
    ================================================= */

    if (
        values.length === 1
    ) {

        stipend =
            values[0];

    }


    /* =================================================
       TWO MONEY VALUES

       Example:

       Barklays 7.5K 5.5L

       Company:
       Barklays

       Stipend:
       7.5K

       CTC:
       5.5L
    ================================================= */

    else if (
        values.length >= 2
    ) {

        stipend =
            values[0];

        ctc =
            values[1];

    }


    console.log(
        "PARSED COMPANY:",
        {
            original: label,
            name: companyName,
            stipend: stipend,
            ctc: ctc
        }
    );


    return {

        name:
            companyName ||
            "Unknown Company",

        stipend:
            stipend,

        ctc:
            ctc

    };

}


/* =========================================================
   GET RAW CELL VALUE
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
       Use Google's formatted value first.

       This prevents:

       160123737001

       from becoming:

       1.60123737001E11
    */

    if (
        cell.f !== undefined &&
        cell.f !== null
    ) {

        return String(
            cell.f
        );

    }


    if (
        cell.v !== undefined &&
        cell.v !== null
    ) {

        return String(
            cell.v
        );

    }


    return "";

}


/* =========================================================
   RENDER COMPANY CARDS
========================================================= */

function renderCompanies(companies) {

    const companyGrid =
        document.getElementById(
            "companyGrid"
        );


    companyGrid.innerHTML = "";


    /* =====================================================
       NO COMPANIES
    ===================================================== */

    if (
        companies.length === 0
    ) {

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
       CREATE CARDS
    ===================================================== */

    companies.forEach(company => {

        const card =
            document.createElement(
                "div"
            );


        card.className =
            "company-card";


        /* =================================================
           STUDENT SECTION
        ================================================= */

        let studentSection =
            "";


        if (
            company.students.length > 0
        ) {

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
                                    student => `

                                        <div
                                            class="student-row"
                                        >

                                            <div
                                                class="student-roll"
                                            >
                                                ${escapeHTML(
                                                    student.roll
                                                )}
                                            </div>


                                            <div
                                                class="student-name"
                                            >
                                                ${escapeHTML(
                                                    student.name
                                                )}
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

                <div
                    class="students-section"
                >

                    <div
                        class="no-students"
                    >

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
                    ${escapeHTML(
                        company.name
                    )}
                </h2>

            </div>


            <div class="card-body">


                <div class="details">


                    <div class="detail-box">

                        <div class="detail-title">
                            Stipend
                        </div>

                        <div class="detail-value">
                            ${escapeHTML(
                                company.stipend
                            )}
                        </div>

                    </div>


                    <div class="detail-box">

                        <div class="detail-title">
                            CTC
                        </div>

                        <div class="detail-value">
                            ${escapeHTML(
                                company.ctc
                            )}
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


        if (
            toggle &&
            studentsList
        ) {

            toggle.addEventListener(
                "click",
                () => {


                    const isOpen =
                        studentsList
                            .classList
                            .contains(
                                "show"
                            );


                    studentsList
                        .classList
                        .toggle(
                            "show"
                        );


                    toggle
                        .classList
                        .toggle(
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


        /* =================================================
           ADD CARD TO GRID
        ================================================= */

        companyGrid.appendChild(
            card
        );

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