const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase connected!");

const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    alert("Bitte zuerst einloggen.");
    window.location.href = "login.html";
    throw new Error("Not logged in");
}

/*
if (currentUser.role !== "admin") {
    alert("Diese Seite ist nur für Admins.");
    window.location.href = "login.html";
    throw new Error("Not admin");
}
*/
//----------------
const IS_ADMIN = currentUser.role === "admin";
const IS_TRAINER = currentUser.role === "trainer";

if (!IS_ADMIN && !IS_TRAINER) {
    alert("Diese Seite ist nur für Admin oder Trainer.");
    window.location.href = "login.html";
    throw new Error("No access");
}
//-----------------
let CURRENT_TRAINER_ID = null;






let allCourses = [];
let allTrainers = [];

//--------------
async function getCurrentTrainerId() {
    if (IS_ADMIN) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("trainers")
        .select("id")
        .eq("email", currentUser.email)
        .single();

    if (error || !data) {
        alert("Trainer wurde nicht gefunden.");
        window.location.href = "Trainer_Dashboard.html";
        throw new Error("Trainer not found");
    }

    return data.id;
}
//--------------

function hoursBetween(start, end) {
    return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
}

function sameDay(dateA, dateB) {
    return dateA.toDateString() === dateB.toDateString();
}

function getMonday(date) {
    const copiedDate = new Date(date);
    const day = copiedDate.getDay();
    const diff = copiedDate.getDate() - day + (day === 0 ? -6 : 1);

    copiedDate.setDate(diff);
    copiedDate.setHours(0, 0, 0, 0);

    return copiedDate;
}

function getSunday(date) {
    const monday = getMonday(date);
    const sunday = new Date(monday);

    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return sunday;
}

function isInCurrentWeek(date) {
    const now = new Date();
    const monday = getMonday(now);
    const sunday = getSunday(now);

    return date >= monday && date <= sunday;
}

function isInCurrentMonth(date) {
    const now = new Date();

    return date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
}

function formatHours(value) {
    return Number(value).toFixed(1).replace(".0", "");
}

function getCourseWorkRows(courses) {
    const sortedCourses = [...courses].sort((a, b) => {
        return new Date(a.start_time) - new Date(b.start_time);
    });

    const rows = [];

    sortedCourses.forEach((course, index) => {
        const startDate = new Date(course.start_time);
        const endDate = new Date(course.end_time);

        const duration = hoursBetween(course.start_time, course.end_time);

        let travelTime = 0;

        const previousCourse = sortedCourses[index - 1];

        if (previousCourse) {
            const previousEnd = new Date(previousCourse.end_time);
            const previousBranchId = previousCourse.rooms?.branch_id;
            const currentBranchId = course.rooms?.branch_id;

            const sameDate = sameDay(previousEnd, startDate);
            const differentBranch = previousBranchId &&
                currentBranchId &&
                previousBranchId !== currentBranchId;

            if (sameDate && differentBranch) {
                travelTime = 1;
            }
        }

        rows.push({
            course: course,
            duration: duration,
            travelTime: travelTime,
            total: duration + travelTime
        });
    });

    return rows;
}

function calculateTotals(courses) {
    const rows = getCourseWorkRows(courses);

    const courseHours = rows.reduce((sum, row) => sum + row.duration, 0);
    const travelHours = rows.reduce((sum, row) => sum + row.travelTime, 0);
    const totalHours = rows.reduce((sum, row) => sum + row.total, 0);

    return {
        rows,
        courseHours,
        travelHours,
        totalHours
    };
}

async function loadTrainers() {
    const { data, error } = await supabaseClient
        .from("trainers")
        .select("id, name, availability, working_hours")
        .order("name", { ascending: true });

    if (error) {
        console.log("Trainer load error:", error);
        alert("Trainer konnten nicht geladen werden.");
        return;
    }

    allTrainers = data || [];

    //-------
    if (IS_TRAINER) {
        document.getElementById("trainerSelect").style.display = "none";
        return;
    }
    //--------

    const trainerSelect = document.getElementById("trainerSelect");
    trainerSelect.innerHTML = `<option value="">Trainer auswählen...</option>`;

    allTrainers.forEach(trainer => {
        trainerSelect.innerHTML += `
            <option value="${trainer.id}">
                ${trainer.name} (${trainer.availability || "-"}, ${trainer.working_hours || 0}h)
            </option>
        `;
    });
}

async function loadCourses() {
    const { data, error } = await supabaseClient
        .from("courses")
        .select(`
            id,
            title,
            trainer_id,
            start_time,
            end_time,
            status,
            rooms (
                id,
                name,
                branch_id,
                branches (
                    name
                )
            )
        `)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Course load error:", error);
        alert("Kurse konnten nicht geladen werden.");
        return;
    }

    allCourses = data || [];
}

function renderEmptyState() {
    document.getElementById("weekHours").innerHTML = `0 <span>/ 0 h</span>`;
    document.getElementById("monthHours").innerHTML = `0 <span>h</span>`;
    document.getElementById("travelHours").innerHTML = `0 <span>h</span>`;
    document.getElementById("todayHours").innerHTML = `0 <span>h</span>`;

    document.getElementById("weekRemaining").innerText = "Bitte Trainer auswählen";
    document.getElementById("monthInfo").innerText = "Keine Daten";
    document.getElementById("todayInfo").innerText = "Keine Kurse heute";
    document.getElementById("chartNote").innerText = "Bitte Trainer auswählen.";

    document.getElementById("weekProgress").style.width = "0%";
    document.getElementById("monthProgress").style.width = "0%";
    document.getElementById("travelProgress").style.width = "0%";
    document.getElementById("todayProgress").style.width = "0%";

    document.getElementById("details-body").innerHTML = "";
    document.getElementById("barChart").innerHTML = "";
    document.getElementById("monthList").innerHTML = "";
    document.getElementById("myCoursesBody").innerHTML = "";
}

function renderForTrainer(trainerId) {
    if (!trainerId) {
        renderEmptyState();
        return;
    }

    const trainer = allTrainers.find(item => item.id === trainerId);

    if (!trainer) {
        renderEmptyState();
        return;
    }

    const contractHours = Number(trainer.working_hours) || 0;

    const trainerCourses = allCourses.filter(course => course.trainer_id === trainerId);

    const currentWeekCourses = trainerCourses.filter(course => {
        return isInCurrentWeek(new Date(course.start_time));
    });

    const currentMonthCourses = trainerCourses.filter(course => {
        return isInCurrentMonth(new Date(course.start_time));
    });

    const todayCourses = trainerCourses.filter(course => {
        return sameDay(new Date(course.start_time), new Date());
    });

    const weekTotals = calculateTotals(currentWeekCourses);
    const monthTotals = calculateTotals(currentMonthCourses);
    const todayTotals = calculateTotals(todayCourses);

    renderInfoBoxes(trainer, weekTotals, monthTotals, todayTotals, contractHours);
    renderDetailsTable(weekTotals.rows);
    renderBarChart(trainerCourses, contractHours);
    renderMonthList(trainerCourses, contractHours);
    renderMyCourses(currentWeekCourses);
}

function renderInfoBoxes(trainer, weekTotals, monthTotals, todayTotals, contractHours) {
    const weekPercent = contractHours > 0
        ? Math.min((weekTotals.totalHours / contractHours) * 100, 100)
        : 0;

    const remaining = Math.max(contractHours - weekTotals.totalHours, 0);

    document.getElementById("weekHours").innerHTML =
        `${formatHours(weekTotals.totalHours)} <span>/ ${contractHours} h</span>`;

    document.getElementById("weekRemaining").innerText =
        `${formatHours(remaining)} Stunden verbleibend`;

    document.getElementById("weekProgress").style.width = `${weekPercent}%`;

    document.getElementById("monthHours").innerHTML =
        `${formatHours(monthTotals.totalHours)} <span>h</span>`;

    document.getElementById("monthInfo").innerText =
        `Kurszeit + Fahrtzeit im aktuellen Monat`;

    document.getElementById("monthProgress").style.width =
        `${Math.min(monthTotals.totalHours * 2, 100)}%`;

    document.getElementById("travelHours").innerHTML =
        `${formatHours(weekTotals.travelHours)} <span>h</span>`;

    document.getElementById("travelProgress").style.width =
        `${Math.min(weekTotals.travelHours * 20, 100)}%`;

    document.getElementById("todayHours").innerHTML =
        `${formatHours(todayTotals.totalHours)} <span>h</span>`;

    if (todayTotals.rows.length === 0) {
        document.getElementById("todayInfo").innerText = "Keine Kurse heute";
    } else {
        const firstCourse = todayTotals.rows[0].course;
        const lastCourse = todayTotals.rows[todayTotals.rows.length - 1].course;

        const start = new Date(firstCourse.start_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        const end = new Date(lastCourse.end_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        document.getElementById("todayInfo").innerText = `${start} - ${end} geplant`;
    }

    document.getElementById("todayProgress").style.width =
        `${Math.min(todayTotals.totalHours * 12.5, 100)}%`;

    document.getElementById("monthTitle").innerText =
        `Arbeitsstunden - ${trainer.name}`;

    document.getElementById("weekDetailsTitle").innerText =
        `Wochendetails - ${trainer.name}`;

    document.getElementById("chartNote").innerText =
        `Maximale Wochenstunden: ${contractHours} h (${trainer.availability || "-"})`;
}

function renderDetailsTable(rows) {
    const detailsBody = document.getElementById("details-body");
    detailsBody.innerHTML = "";

    if (rows.length === 0) {
        detailsBody.innerHTML = `
            <tr>
                <td colspan="6">Keine Kurse diese Woche.</td>
            </tr>
        `;
        return;
    }

    rows.forEach(row => {
        const course = row.course;
        const startDate = new Date(course.start_time);
        const endDate = new Date(course.end_time);

        const day = startDate.toLocaleDateString("de-DE", {
            weekday: "short"
        });

        const date = startDate.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit"
        });

        const start = startDate.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        const end = endDate.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        detailsBody.innerHTML += `
            <tr>
                <td>${day}<br>${date}</td>
                <td>${course.title}</td>
                <td>${start} -<br>${end}</td>
                <td>${formatHours(row.duration)} h</td>
                <td>${formatHours(row.travelTime)} h</td>
                <td>${formatHours(row.total)} h</td>
            </tr>
        `;
    });
}

function getWeekNumber(date) {
    const copiedDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ));

    const dayNumber = copiedDate.getUTCDay() || 7;
    copiedDate.setUTCDate(copiedDate.getUTCDate() + 4 - dayNumber);

    const yearStart = new Date(Date.UTC(copiedDate.getUTCFullYear(), 0, 1));

    return Math.ceil((((copiedDate - yearStart) / 86400000) + 1) / 7);
}

function groupCoursesByWeek(courses) {
    const grouped = {};

    courses.forEach(course => {
        const date = new Date(course.start_time);
        const weekNumber = getWeekNumber(date);
        const key = `${date.getFullYear()}-KW${weekNumber}`;

        if (!grouped[key]) {
            grouped[key] = [];
        }

        grouped[key].push(course);
    });

    return grouped;
}

function renderBarChart(courses, contractHours) {
    const barChart = document.getElementById("barChart");
    barChart.innerHTML = "";

    const grouped = groupCoursesByWeek(courses);
    const entries = Object.entries(grouped).slice(-5);

    if (entries.length === 0) {
        barChart.innerHTML = `<p style="font-family: sans-serif;">Keine Kursdaten.</p>`;
        return;
    }

    entries.forEach(([weekKey, weekCourses]) => {
        const totals = calculateTotals(weekCourses);
        const height = contractHours > 0
            ? Math.max((totals.totalHours / contractHours) * 160, 15)
            : 15;

        const weekLabel = weekKey.split("-")[1];

        barChart.innerHTML += `
            <div class="bar-item">
                <p>${formatHours(totals.totalHours)}h</p>
                <div class="bar blue" style="height: ${height}px;"></div>
                <span>${weekLabel}</span>
            </div>
        `;
    });
}

function renderMonthList(courses, contractHours) {
    const monthList = document.getElementById("monthList");
    monthList.innerHTML = "";

    const grouped = groupCoursesByWeek(courses);
    const entries = Object.entries(grouped).slice(-5);

    if (entries.length === 0) {
        monthList.innerHTML = `<p style="font-family: sans-serif;">Keine Wochen vorhanden.</p>`;
        return;
    }

    entries.forEach(([weekKey, weekCourses]) => {
        const totals = calculateTotals(weekCourses);
        const weekLabel = weekKey.split("-")[1];

        let statusClass = "ok";
        let statusText = "OK";

        if (totals.totalHours > contractHours) {
            statusClass = "reduced";
            statusText = "Überlastet";
        } else if (totals.totalHours === 0) {
            statusClass = "reduced";
            statusText = "Leer";
        } else if (isInCurrentWeek(new Date(weekCourses[0].start_time))) {
            statusClass = "running";
            statusText = "Laufend";
        }

        const sorted = [...weekCourses].sort((a, b) => {
            return new Date(a.start_time) - new Date(b.start_time);
        });

        const firstDate = new Date(sorted[0].start_time).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit"
        });

        const lastDate = new Date(sorted[sorted.length - 1].start_time).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit"
        });

        monthList.innerHTML += `
            <div class="month-row">
                <div>
                    <p class="kw">${weekLabel}</p>
                    <p class="date">${firstDate} - ${lastDate}</p>
                </div>
                <div class="month-right">
                    <p>${formatHours(totals.totalHours)} / ${contractHours} h</p>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    });
}

function renderMyCourses(courses) {
    const myCoursesBody = document.getElementById("myCoursesBody");
    myCoursesBody.innerHTML = "";

    if (courses.length === 0) {
        myCoursesBody.innerHTML = `
            <tr>
                <td colspan="2">Keine Kurse diese Woche.</td>
            </tr>
        `;
        return;
    }

    courses.forEach(course => {
        const date = new Date(course.start_time);

        const day = date.toLocaleDateString("de-DE", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit"
        });

        myCoursesBody.innerHTML += `
            <tr>
                <td>${course.title}</td>
                <td>${day}</td>
            </tr>
        `;
    });
}

//document.getElementById("trainerSelect").onchange = event => {
    //renderForTrainer(event.target.value);
//-----------
if (IS_ADMIN) {
    document.getElementById("trainerSelect").onchange = event => {
        renderForTrainer(event.target.value);
    };
}
//-----------

/*
async function init() {
    renderEmptyState();

    await loadTrainers();
    await loadCourses();
}
    */
//------
async function init() {
    renderEmptyState();

    CURRENT_TRAINER_ID = await getCurrentTrainerId();

    await loadTrainers();
    await loadCourses();

    if (IS_TRAINER) {
        renderForTrainer(CURRENT_TRAINER_ID);
    }
} 
//-------------- 

init();