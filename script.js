/* =========================================================
   GOOGLE SHEET CONFIGURATION
========================================================= */

const SHEET_ID =
    "1gMLik20lPryuWYmKSk9qU_fPxYcMq31zpTjiJzgze7M";

const SHEET_NAME =
    "IT";


/* =========================================================
   MAIN GOOGLE SHEET URL

   IMPORTANT:
   Do NOT use headers=0 or headers=1 here.

   We keep the original working request because it correctly
   returns the student rows and company checkbox columns.
========================================================= */

const SHEET_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;


/* =========================================================
   COMPANY METADATA URL

   Your sheet is:

   Row 1 → Company
   Row 2 → Role
   Row 3 → Stipend
   Row 4 → CTC

   C = first company column
   Z = maximum supported column

   This request is ONLY for company metadata.
========================================================= */

const META_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&range=C1:Z4&headers=0`;

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
            SHEET_URL
        );

        console.log(
            "================================="
        );


        /* =================================================
           FETCH MAIN STUDENT DATA
        ================================================= */

        const response =
            await fetch(
                SHEET_URL
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


        /* =================================================
           PARSE GVIZ RESPONSE
        ================================================= */

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


        /* =================================================
           FETCH COMPANY METADATA

           C1:Z3

           Row 1 → Company
           Row 2 → Role
           Row 3 → Stipend
           Row 4 → CTC
        ================================================= */

        console.log(
            "================================="
        );

        console.log(
            "Loading company metadata..."
        );

        console.log(
            META_URL
        );


        const metaResponse =
            await fetch(
                META_URL
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


        /* =================================================
           PROCESS DATA

           IMPORTANT:
           The original student-processing logic remains
           unchanged.
        ================================================= */

        allCompanies =
            processSheet(
                data.table,
                metaData.table
            );

        console.log(
            "FINAL COMPANIES:",
            allCompanies
        );

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
        "NUMBER OF STUDENTS:",
        rows.length
    );


    const companies = [];


    /* =====================================================
       METADATA ROWS

       metaTable is C1:Z3.

       metaRows[0] → Row 1 → company names
       metaRows[2] → Row 2 → stipend
       metaRows[3] → Row 3 → CTC
    ===================================================== */

    const metaRows =
        metaTable.rows || [];


    console.log(
        "METADATA ROWS:",
        metaRows.length
    );


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

           Main sheet:
               C = columnIndex 2
               D = columnIndex 3
               E = columnIndex 4

           Metadata range starts at C:

               metadata 0 = C
               metadata 2 = D
               metadata 3 = E

           Therefore:

               metaColumnIndex = columnIndex - 2
        ================================================= */

        const metaColumnIndex =
            columnIndex - 2;


        /* =================================================
           COMPANY NAME
        ================================================= */

        const companyName =
            getDisplayValue(
                metaRows[0]?.c?.[
                    metaColumnIndex
                ]
            ).trim();


        /* =================================================
           STIPEND
        ================================================= */

        const stipend =
            getDisplayValue(
                metaRows[2]?.c?.[
                    metaColumnIndex
                ]
            ).trim();


        /* =================================================
           CTC
        ================================================= */

        const ctc =
            getDisplayValue(
                metaRows[3]?.c?.[
                    metaColumnIndex
                ]
            ).trim();


        console.log(
            "COMPANY METADATA:",
            {
                columnIndex:
                    columnIndex,

                metaColumnIndex:
                    metaColumnIndex,

                companyName:
                    companyName,

                stipend:
                    stipend,

                ctc:
                    ctc
            }
        );


        /* =================================================
           FALLBACK COMPANY NAME

           In case metadata somehow does not contain the
           company name, use the original GViz column label.

           This keeps the application robust.
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

            console.log(
                "Skipping empty column"
            );

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

                   This is the IMPORTANT part.

                   We continue using the original
                   cells[columnIndex] logic.
                ----------------------------------------- */

                const companyCell =
                    cells[columnIndex];


                const value =
                    getCellValue(
                        companyCell
                    );


                /* -----------------------------------------
                   GOOGLE CHECKBOX VALUES

                   true
                   "TRUE"
                   false
                   "FALSE"
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


        /* =====================================================
        COUNT
        ===================================================== */

        const count = selectedStudents.length;


        /* =====================================================
        IGNORE COMPANIES WITH ZERO STUDENTS
        ===================================================== */

        if (count === 0) {
            console.log(
                "Skipping company with 0 students:",
                finalCompanyName
            );

            continue;
        }


        /* =====================================================
        CREATE COMPANY OBJECT
        ===================================================== */

        const company = {

            name: finalCompanyName,

            stipend: stipend || "—",

            ctc: ctc || "—",

            count: count,

            students: selectedStudents

        };


        /* =====================================================
        ADD COMPANY
        ===================================================== */

        companies.push(company);


        /* =================================================
           LOG FINAL COMPANY DATA
        ================================================= */

        console.log(
            "COMPANY DATA:",
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

       We prefer f because roll numbers such as:

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
               ADD CARD TO GRID
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

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const searchInput =
            document.getElementById(
                "companySearch"
            );

        if (!searchInput) {
            return;
        }

        searchInput.addEventListener(
            "input",
            () => {

                const searchText =
                    searchInput.value
                        .trim()
                        .toLowerCase();


                /* =========================================
                   EMPTY SEARCH
                   Show all companies
                ========================================= */

                if (!searchText) {

                    renderCompanies(
                        allCompanies
                    );

                    return;
                }


                /* =========================================
                   SEARCH COMPANY / STUDENT / ROLL NUMBER

                   Examples:

                   "bar"       → Barclays
                   "ubs"       → UBS
                   "keerthana" → companies where Keerthana
                                  is placed
                   "160123"    → companies containing
                                  that roll number
                ========================================= */

                const filteredCompanies =
                    allCompanies
                        .map(company => {

                            const companyName =
                                String(
                                    company.name || ""
                                ).toLowerCase();


                            /* =================================
                               COMPANY MATCH
                            ================================= */

                            const companyMatches =
                                companyName.includes(
                                    searchText
                                );


                            /* =================================
                               STUDENT MATCH
                            ================================= */

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
                               RETURN COMPANY

                               If company name matches:
                               → show all students

                               If student/roll matches:
                               → show only matching students
                            ================================= */

                            if (companyMatches) {

                                return company;

                            }


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

                        })
                        .filter(
                            company => company !== null
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

                        <div class="no-data">

                            <h3>
                                No results found
                            </h3>

                            <p>
                                No company, student or roll number
                                matches
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
        );

    }
);

/* =========================================================
   START APPLICATION
========================================================= */

loadSheet();
