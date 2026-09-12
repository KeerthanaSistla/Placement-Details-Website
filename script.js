/* =========================================================
   GOOGLE SHEET CONFIGURATION
========================================================= */

const SHEET_ID =
    "1gMLik20lPryuWYmKSk9qU_fPxYcMq31zpTjiJzgze7M";


/* =========================================================
   CURRENT SHEET
=========================================================

   All Sections → IT
   IT 1         → IT1
   IT 2         → IT2
   IT 3         → IT3
========================================================= */

let SHEET_NAME = "IT";


/* =========================================================
   MAIN GOOGLE SHEET URL
========================================================= */

function getSheetURL() {

    return (
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
        `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`
    );

}


/* =========================================================
   COMPANY METADATA URL
=========================================================

   IT:

   Row 1 → Company
   Row 2 → Role
   Row 3 → Stipend
   Row 4 → CTC


   IT1 / IT2 / IT3:

   Row 1 → Company
   Row 2 → Stipend
   Row 3 → CTC


   C = first company column
   Z = maximum supported column
========================================================= */

function getMetaURL() {

    return (
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
        `?tqx=out:json&range=${encodeURIComponent(
            SHEET_NAME + "!C1:Z4"
        )}&headers=0`
    );

}


let allCompanies = [];


/* =========================================================
   LOAD SHEET
========================================================= */

async function loadSheet() {

    const companyGrid =
        document.getElementById(
            "companyGrid"
        );


    companyGrid.innerHTML = `

        <div class="loading">
            Loading placement data...
        </div>

    `;


    try {

        console.log(
            "================================="
        );

        console.log(
            "Loading sheet..."
        );

        console.log(
            "Current sheet:",
            SHEET_NAME
        );

        console.log(
            "Sheet URL:",
            getSheetURL()
        );

        console.log(
            "Metadata URL:",
            getMetaURL()
        );

        console.log(
            "================================="
        );


        /* =========================================
           FETCH MAIN STUDENT DATA
        ========================================= */

        const response =
            await fetch(
                getSheetURL()
            );


        if (!response.ok) {

            throw new Error(
                `Google Sheets returned ${response.status}`
            );

        }


        const text =
            await response.text();


        console.log(
            "Google response:"
        );

        console.log(
            text
        );


        /* =========================================
           PARSE GVIZ RESPONSE
        ========================================= */

        const data =
            parseGoogleResponse(
                text
            );


        console.log(
            "Parsed Google data:",
            data
        );


        if (
            !data.table ||
            !data.table.cols ||
            !data.table.rows
        ) {

            throw new Error(
                "No table data found."
            );

        }


        /* =========================================
           FETCH COMPANY METADATA
        ========================================= */

        console.log(
            "================================="
        );

        console.log(
            "Loading company metadata..."
        );

        console.log(
            getMetaURL()
        );


        const metaResponse =
            await fetch(
                getMetaURL()
            );


        if (!metaResponse.ok) {

            throw new Error(
                `Could not load company metadata: ${metaResponse.status}`
            );

        }


        const metaText =
            await metaResponse.text();


        console.log(
            "Company metadata response:"
        );

        console.log(
            metaText
        );


        const metaData =
            parseGoogleResponse(
                metaText
            );


        console.log(
            "Parsed company metadata:",
            metaData
        );


        if (
            !metaData.table
        ) {

            throw new Error(
                "Could not read company metadata."
            );

        }


        /* =========================================
           PROCESS DATA
        ========================================= */

        allCompanies =
            processSheet(
                data.table,
                metaData.table
            );


        console.log(
            "FINAL COMPANIES:",
            allCompanies
        );


        /* =========================================
           SORT COMPANIES

           1. CTC — highest first
           2. Stipend — highest first
           3. Neither — last
        ========================================= */

        allCompanies.sort(
            compareCompanies
        );


        /* =========================================
           UPDATE DASHBOARD
        ========================================= */

        updateDashboardSummary(
            allCompanies
        );


        /* =========================================
           RENDER
        ========================================= */

        renderCompanies(
            allCompanies
        );

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
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}


/* =========================================================
   PARSE GOOGLE GVIZ RESPONSE
========================================================= */

function parseGoogleResponse(
    text
) {

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
        text.substring(
            start,
            end
        );


    return JSON.parse(
        jsonText
    );

}


/* =========================================================
   PROCESS GOOGLE SHEET
========================================================= */

function processSheet(
    table,
    metaTable
) {

    const columns =
        table.cols || [];


    const rows =
        table.rows || [];


    console.log(
        "NUMBER OF COLUMNS:",
        columns.length
    );


    console.log(
        "NUMBER OF STUDENT ROWS:",
        rows.length
    );


    const companies = [];


    /* =====================================================
       DETERMINE SHEET STRUCTURE

       IT:

       metaRows[0] → Company
       metaRows[1] → Role
       metaRows[2] → Stipend
       metaRows[3] → CTC


       IT1 / IT2 / IT3:

       metaRows[0] → Company
       metaRows[1] → Stipend
       metaRows[2] → CTC

       There is NO role row in IT1/IT2/IT3.
    ===================================================== */

    const metaRows =
        metaTable.rows || [];


    const isMainSheet =
        SHEET_NAME === "IT";


    console.log(
        "IS MAIN IT SHEET:",
        isMainSheet
    );


    console.log(
        "METADATA ROWS:",
        metaRows.length
    );


    /* =====================================================
       METADATA ROW MAPPING
    ===================================================== */

    const companyMetaRow =
        0;


    const roleMetaRow =
        isMainSheet
            ? 1
            : null;


    const stipendMetaRow =
        isMainSheet
            ? 2
            : 1;


    const ctcMetaRow =
        isMainSheet
            ? 3
            : 2;


    /* =====================================================
       COMPANY COLUMNS

       columns[0] = Roll Number
       columns[1] = Name
       columns[2+] = Companies
    ===================================================== */

    for (
        let columnIndex = 2;
        columnIndex < columns.length;
        columnIndex++
    ) {

        const column =
            columns[columnIndex];


        console.log(
            "================================="
        );


        console.log(
            "COLUMN:",
            columnIndex
        );


        /* =================================================
           METADATA COLUMN

           Metadata starts from column C.

           Therefore:

           metaColumnIndex =
               columnIndex - 2
        ================================================= */

        const metaColumnIndex =
            columnIndex - 2;


        /* =================================================
           COMPANY NAME
        ================================================= */

        const companyName =
            getDisplayValue(
                metaRows[
                    companyMetaRow
                ]?.c?.[
                    metaColumnIndex
                ]
            ).trim();


        /* =================================================
           ROLE

           IT:
               Read role from metadata.

           IT1 / IT2 / IT3:
               There is no role row.
               Therefore display "—".
        ================================================= */

        let role = "—";


        if (
            roleMetaRow !== null
        ) {

            role =
                getDisplayValue(
                    metaRows[
                        roleMetaRow
                    ]?.c?.[
                        metaColumnIndex
                    ]
                ).trim();

        }


        /* =================================================
           STIPEND
        ================================================= */

        const stipend =
            getDisplayValue(
                metaRows[
                    stipendMetaRow
                ]?.c?.[
                    metaColumnIndex
                ]
            ).trim();


        /* =================================================
           CTC
        ================================================= */

        const ctc =
            getDisplayValue(
                metaRows[
                    ctcMetaRow
                ]?.c?.[
                    metaColumnIndex
                ]
            ).trim();


        console.log(
            "COMPANY:",
            companyName
        );


        console.log(
            "ROLE:",
            role
        );


        console.log(
            "STIPEND:",
            stipend
        );


        console.log(
            "CTC:",
            ctc
        );


        /* =================================================
           FALLBACK COMPANY NAME
        ================================================= */

        let finalCompanyName =
            companyName;


        if (
            !finalCompanyName
        ) {

            finalCompanyName =
                String(
                    column.label || ""
                ).trim();

        }


        /* =================================================
           IGNORE EMPTY COLUMNS
        ================================================= */

        if (
            !finalCompanyName
        ) {

            continue;

        }


        /* =================================================
           FIND STUDENTS
        ================================================= */

        const selectedStudents =
            [];


        rows.forEach(
            row => {

                const cells =
                    row.c || [];


                /* -----------------------------------------
                   ROLL NUMBER
                ----------------------------------------- */

                const roll =
                    getDisplayValue(
                        cells[0]
                    );


                /* -----------------------------------------
                   STUDENT NAME
                ----------------------------------------- */

                const name =
                    getDisplayValue(
                        cells[1]
                    );


                /* -----------------------------------------
                   IGNORE EMPTY ROWS
                ----------------------------------------- */

                if (
                    !roll &&
                    !name
                ) {

                    return;

                }


                /* -----------------------------------------
                   COMPANY VALUE
                ----------------------------------------- */

                const companyCell =
                    cells[columnIndex];


                const value =
                    getCellValue(
                        companyCell
                    );


                /* -----------------------------------------
                   CHECKBOX VALUE
                ----------------------------------------- */

                const selected =
                    value === true ||
                    String(value)
                        .trim()
                        .toLowerCase() ===
                    "true";


                if (
                    selected
                ) {

                    selectedStudents.push({

                        roll:
                            roll,

                        name:
                            name

                    });

                }

            }
        );


        /* =================================================
           COUNT
        ================================================= */

        const count =
            selectedStudents.length;


        /* =================================================
           IGNORE COMPANIES WITH ZERO STUDENTS
        ================================================= */

        if (
            count === 0
        ) {

            continue;

        }


        /* =================================================
           CREATE COMPANY OBJECT
        ================================================= */

        const company = {

            name:
                finalCompanyName,

            role:
                role || "—",

            stipend:
                stipend || "—",

            ctc:
                ctc || "—",

            count:
                count,

            students:
                selectedStudents

        };


        companies.push(
            company
        );

    }


    return companies;

}


/* =========================================================
   GET RAW CELL VALUE
========================================================= */

function getCellValue(
    cell
) {

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

function getDisplayValue(
    cell
) {

    if (!cell) {

        return "";

    }


    /*
       Google provides:

       v = raw value
       f = formatted/display value

       Prefer f because roll numbers such as:

       160123737001

       should not become:

       1.60123737001E11
    */

    if (
        cell.f !== undefined &&
        cell.f !== null
    ) {

        return String(
            cell.f
        ).trim();

    }


    if (
        cell.v !== undefined &&
        cell.v !== null
    ) {

        return String(
            cell.v
        ).trim();

    }


    return "";

}


/* =========================================================
   PARSE NUMERIC AMOUNT
========================================================= */

function parseAmount(
    value
) {

    if (
        !value ||
        value === "—"
    ) {

        return null;

    }


    const cleaned =
        String(value)
            .replace(/,/g, "")
            .replace(/[₹$]/g, "")
            .trim()
            .toLowerCase();


    const match =
        cleaned.match(
            /([\d.]+)\s*(lpa|lakh|lakhs|k)?/
        );


    if (!match) {

        return null;

    }


    let amount =
        parseFloat(
            match[1]
        );


    const unit =
        match[2];


    if (
        unit === "lpa" ||
        unit === "lakh" ||
        unit === "lakhs"
    ) {

        amount *= 100000;

    }

    else if (
        unit === "k"
    ) {

        amount *= 1000;

    }


    return amount;

}


/* =========================================================
   FORMAT NUMERIC AMOUNT
========================================================= */

function formatAmount(
    amount
) {

    if (
        amount === null ||
        amount === undefined ||
        Number.isNaN(amount)
    ) {

        return "—";

    }


    if (
        amount >= 100000
    ) {

        return (
            (amount / 100000).toFixed(2) +
            " LPA"
        );

    }


    if (
        amount >= 1000
    ) {

        return (
            (amount / 1000).toFixed(2) +
            "K"
        );

    }


    return amount.toFixed(2);

}


/* =========================================================
   SORT COMPANIES

   1. CTC — highest first
   2. If CTC is same → Stipend — highest first
   3. Missing values are treated as 0
========================================================= */

function compareCompanies(
    a,
    b
) {

    const ctcA =
        parseAmount(a.ctc) ?? 0;


    const ctcB =
        parseAmount(b.ctc) ?? 0;


    /* PRIMARY SORT: CTC */

    if (
        ctcA !== ctcB
    ) {

        return ctcB - ctcA;

    }


    /* SECONDARY SORT: STIPEND */

    const stipendA =
        parseAmount(a.stipend) ?? 0;


    const stipendB =
        parseAmount(b.stipend) ?? 0;


    if (
        stipendA !== stipendB
    ) {

        return stipendB - stipendA;

    }


    return 0;

}


/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

function updateDashboardSummary(
    companies
) {

    /* =========================================
       TOTAL COMPANIES
    ========================================= */

    const totalCompanies =
        companies.length;


    /* =========================================
       UNIQUE STUDENTS
    ========================================= */

    const students =
        new Map();


    companies.forEach(
        company => {

            company.students.forEach(
                student => {

                    const roll =
                        String(
                            student.roll || ""
                        ).trim();


                    const name =
                        String(
                            student.name || ""
                        ).trim();


                    /*
                       Use roll number as the
                       primary identifier.

                       Fall back to name if
                       roll number is unavailable.
                    */

                    const key =
                        roll ||
                        name.toLowerCase();


                    if (
                        key
                    ) {

                        students.set(
                            key,
                            student
                        );

                    }

                }
            );

        }
    );


    const totalStudents =
        students.size;


    /* =========================================
       HIGHEST CTC
    ========================================= */

    const highestCTC =
        getHighestAmount(
            companies,
            "ctc"
        );


    /* =========================================
       STUDENT-WEIGHTED AVERAGE CTC

       Companies without CTC are excluded.

       Each company's CTC is weighted by
       the number of students placed.
    ========================================= */

    let totalCTCValue =
        0;


    let totalCTCStudents =
        0;


    companies.forEach(
        company => {

            const ctc =
                parseAmount(
                    company.ctc
                );


            if (
                ctc === null ||
                !company.count
            ) {

                return;

            }


            totalCTCValue +=
                ctc *
                company.count;


            totalCTCStudents +=
                company.count;

        }
    );


    const averageCTC =
        totalCTCStudents > 0
            ? totalCTCValue /
              totalCTCStudents
            : null;


    /* =========================================
       UPDATE UI
    ========================================= */

    document.getElementById(
        "totalCompanies"
    ).textContent =
        totalCompanies;


    document.getElementById(
        "totalStudents"
    ).textContent =
        totalStudents;


    document.getElementById(
        "highestCTC"
    ).textContent =
        highestCTC || "—";


    document.getElementById(
        "averageCTC"
    ).textContent =
        averageCTC !== null
            ? formatAmount(
                averageCTC
            )
            : "—";

}


/* =========================================================
   FIND HIGHEST AMOUNT
========================================================= */

function getHighestAmount(
    companies,
    property
) {

    let highest =
        null;


    companies.forEach(
        company => {

            const value =
                String(
                    company[property] || ""
                ).trim();


            if (
                !value ||
                value === "—"
            ) {

                return;

            }


            const amount =
                parseAmount(
                    value
                );


            if (
                amount === null
            ) {

                return;

            }


            if (
                highest === null ||
                amount > highest.amount
            ) {

                highest = {

                    amount:
                        amount,

                    display:
                        value

                };

            }

        }
    );


    return highest
        ? highest.display
        : null;

}


/* =========================================================
   RENDER COMPANY CARDS
========================================================= */

function renderCompanies(
    companies
) {

    const companyGrid =
        document.getElementById(
            "companyGrid"
        );


    companyGrid.innerHTML =
        "";


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

    companies.forEach(
        company => {

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

                    <div
                        class="students-section"
                    >

                        <button
                            class="students-toggle"
                            type="button"
                        >

                            <span>
                                Show Students
                            </span>

                            <span
                                class="arrow"
                            >
                                ▼
                            </span>

                        </button>


                        <div
                            class="students-list"
                        >

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

                <div
                    class="card-header"
                >

                    <h2>

                        ${escapeHTML(
                            company.name
                        )}

                    </h2>

                </div>


                <div
                    class="card-body"
                >

                    <!-- =====================================
                         ROLE
                    ====================================== -->

                    <div
                        class="role"
                        style="
                            text-align: center;
                            color: #777;
                            font-size: 14px;
                            margin-bottom: 18px;
                        "
                    >

                        ${escapeHTML(
                            company.role
                        )}

                    </div>


                    <!-- =====================================
                         STIPEND / CTC
                    ====================================== -->

                    <div
                        class="details"
                    >

                        <div
                            class="detail-box"
                        >

                            <div
                                class="detail-title"
                            >

                                Stipend

                            </div>


                            <div
                                class="detail-value"
                            >

                                ${escapeHTML(
                                    company.stipend
                                )}

                            </div>

                        </div>


                        <div
                            class="detail-box"
                        >

                            <div
                                class="detail-title"
                            >

                                CTC

                            </div>


                            <div
                                class="detail-value"
                            >

                                ${escapeHTML(
                                    company.ctc
                                )}

                            </div>

                        </div>

                    </div>


                    <!-- =====================================
                         STUDENT COUNT
                    ====================================== -->

                    <div
                        class="count-box"
                    >

                        <div
                            class="count-label"
                        >

                            Students

                        </div>


                        <div
                            class="count-value"
                        >

                            ${company.count}

                        </div>

                    </div>


                    <!-- =====================================
                         STUDENTS
                    ====================================== -->

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


                        if (
                            isOpen
                        ) {

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
               ADD CARD
            ================================================= */

            companyGrid.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value
    )

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
   COMPANY / STUDENT SEARCH
========================================================= */

function applySearch() {

    const searchInput =
        document.getElementById(
            "companySearch"
        );


    if (!searchInput) {

        return;

    }


    const searchText =
        searchInput.value
            .trim()
            .toLowerCase();


    /* =========================================
       EMPTY SEARCH
    ========================================= */

    if (!searchText) {

        renderCompanies(
            allCompanies
        );

        return;

    }


    /* =========================================
       SEARCH COMPANY / STUDENT / ROLL NUMBER
    ========================================= */

    const filteredCompanies =
        allCompanies

            .map(
                company => {

                    const companyName =
                        String(
                            company.name || ""
                        ).toLowerCase();


                    const companyMatches =
                        companyName.includes(
                            searchText
                        );


                    const matchingStudents =
                        company.students.filter(
                            student => {

                                const studentName =
                                    String(
                                        student.name || ""
                                    ).toLowerCase();


                                const studentRoll =
                                    String(
                                        student.roll || ""
                                    ).toLowerCase();


                                return (
                                    studentName.includes(
                                        searchText
                                    ) ||
                                    studentRoll.includes(
                                        searchText
                                    )
                                );

                            }
                        );


                    /* =================================
                       COMPANY MATCH

                       Show all students.
                    ================================= */

                    if (
                        companyMatches
                    ) {

                        return company;

                    }


                    /* =================================
                       STUDENT MATCH

                       Show only matching students.
                    ================================= */

                    if (
                        matchingStudents.length > 0
                    ) {

                        return {

                            ...company,

                            students:
                                matchingStudents,

                            count:
                                matchingStudents.length

                        };

                    }


                    return null;

                }
            )

            .filter(
                company =>
                    company !== null
            );


    console.log(
        "Search:",
        searchText
    );


    console.log(
        "Matching companies:",
        filteredCompanies
    );


    /* =========================================
       NO MATCHES
    ========================================= */

    if (
        filteredCompanies.length === 0
    ) {

        document.getElementById(
            "companyGrid"
        ).innerHTML = `

            <div
                class="no-data"
            >

                <h3>
                    No results found
                </h3>

                <p>

                    No company, student or
                    roll number matches
                    "${escapeHTML(
                        searchInput.value
                    )}"

                </p>

            </div>

        `;

        return;

    }


    /* =========================================
       RENDER RESULTS
    ========================================= */

    renderCompanies(
        filteredCompanies
    );

}


/* =========================================================
   SECTION FILTER
========================================================= */

function changeSection(
    selectedSection
) {

    /* =========================================
       MAP DROPDOWN VALUE → SHEET NAME
    ========================================= */

    switch (
        selectedSection
    ) {

        case "A":

            SHEET_NAME =
                "IT1";

            break;


        case "B":

            SHEET_NAME =
                "IT2";

            break;


        case "C":

            SHEET_NAME =
                "IT3";

            break;


        case "all":

        default:

            SHEET_NAME =
                "IT";

            break;

    }


    console.log(
        "Selected section:",
        selectedSection
    );


    console.log(
        "Loading sheet:",
        SHEET_NAME
    );


    /* =========================================
       CLEAR OLD SEARCH
    ========================================= */

    const searchInput =
        document.getElementById(
            "companySearch"
        );


    if (
        searchInput
    ) {

        searchInput.value =
            "";

    }


    /* =========================================
       LOAD SELECTED SHEET
    ========================================= */

    loadSheet();

}


/* =========================================================
   INITIALIZE APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* =========================================
           COMPANY / STUDENT SEARCH
        ========================================= */

        const searchInput =
            document.getElementById(
                "companySearch"
            );


        if (
            searchInput
        ) {

            searchInput.addEventListener(
                "input",
                applySearch
            );

        }


        /* =========================================
           SECTION FILTER
        ========================================= */

        const sectionFilter =
            document.getElementById(
                "sectionFilter"
            );


        if (
            sectionFilter
        ) {

            sectionFilter.addEventListener(
                "change",
                () => {

                    changeSection(
                        sectionFilter.value
                    );

                }
            );

        }

    }
);


/* =========================================================
   START APPLICATION
========================================================= */

loadSheet();