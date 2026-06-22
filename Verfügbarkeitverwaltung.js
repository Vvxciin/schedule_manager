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

if (currentUser.role !== "trainer") {
    alert("Diese Seite ist nur für Trainer.");
    window.location.href = "login.html";
    throw new Error("Not trainer");
}

const trainerId = currentUser.id;

let currentWeekStart = getMonday(new Date());

const days = [
    { label: "Mo", offset: 0 },
    { label: "Di", offset: 1 },
    { label: "Mi", offset: 2 },
    { label: "Do", offset: 3 },
    { label: "Fr", offset: 4 },
    { label: "Sa", offset: 5 }
];

const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const roomOrder = {
    "Room A": 1,
    "Room B": 2,
    "Room C": 3,
    "Room D": 4,
    "Room E": 5,
    "Room G": 6,
    "Room V": 7
};

function getRoomRank(course) {
    const roomName = course.rooms?.name || "";
    return roomOrder[roomName] || 999;
}

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    d.setDate(diff);
    d.setHours(0, 0, 0, 0);

    return d;
}

function addDays(date, daysToAdd) {
    const d = new Date(date);
    d.setDate(d.getDate() + daysToAdd);
    return d;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatGermanDate(date) {
    return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function updateWeekTitle() {
    const weekEnd = addDays(currentWeekStart, 5);

    document.getElementById("weekTitle").innerText =
        `Mein Wochenplan (${formatGermanDate(currentWeekStart)} - ${formatGermanDate(weekEnd)})`;

    document.getElementById("trainerInfoText").innerText =
        `${currentUser.name || "Trainer"} | ${currentUser.role || "-"}`;
}

function buildTrainerScheduleHeader() {
    const head = document.getElementById("trainerScheduleHead");

    let html = `
        <tr>
            <th>Tag</th>
    `;

    hours.forEach(hour => {
        html += `<th>${hour} - ${hour + 1}</th>`;
    });

    html += `</tr>`;

    head.innerHTML = html;
}

async function loadTrainerWeeklySchedule() {
    updateWeekTitle();

    const weekStart = formatDate(currentWeekStart);
    const weekAfter = formatDate(addDays(currentWeekStart, 7));

    const { data, error } = await supabaseClient
        .from("courses")
        .select(`
            id,
            title,
            trainer_id,
            room_id,
            start_time,
            end_time,
            max_participants,
            current_participants,
            status,
            rooms (
                name,
                branch_id,
                branches (
                    name
                )
            )
        `)
        .eq("trainer_id", trainerId)
        .gte("start_time", weekStart + "T00:00:00")
        .lt("start_time", weekAfter + "T00:00:00")
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Load trainer schedule error:", error);
        alert("Wochenplan konnte nicht geladen werden.");
        return;
    }

    await renderTrainerSchedule(data || []);
}

async function renderTrainerSchedule(courses) {
    const body = document.getElementById("trainerScheduleBody");
    body.innerHTML = "";

    const absences = await loadAbsencesForCurrentWeek();

    days.forEach(day => {
        const row = document.createElement("tr");

        const dayCell = document.createElement("th");
        dayCell.innerText = day.label;
        row.appendChild(dayCell);

        const currentDayDate = formatDate(addDays(currentWeekStart, day.offset));

        hours.forEach(hour => {
            const cell = document.createElement("td");

            const slotStart = `${currentDayDate}T${String(hour).padStart(2, "0")}:00:00`;
            const slotEnd = `${currentDayDate}T${String(hour + 1).padStart(2, "0")}:00:00`;

            const isAbsent = absences.some(absence => {
                const absenceStart = `${absence.start_date}T${absence.start_time || "00:00:00"}`;
                const absenceEnd = `${absence.end_date}T${absence.end_time || "23:59:59"}`;

                return absenceStart < slotEnd && absenceEnd > slotStart;
            });

            if (isAbsent) {
                cell.classList.add("absence-cell");
                cell.innerHTML = `<div class="absence-block">Abwesend</div>`;
            }

            const coursesForCell = courses
                .filter(course => {
                    if (!course.start_time) {
                        return false;
                    }

                    const courseDate = course.start_time.slice(0, 10);
                    const courseHour = Number(course.start_time.slice(11, 13));

                    return courseDate === currentDayDate && courseHour === hour;
                })
                .sort((a, b) => getRoomRank(a) - getRoomRank(b));

            coursesForCell.forEach(course => {
                cell.appendChild(createTrainerCourseCard(course));
            });

            row.appendChild(cell);
        });

        body.appendChild(row);
    });
}

function createTrainerCourseCard(course) {
    const card = document.createElement("div");

    const titleClass = getCourseClass(course.title);
    const statusClass = getStatusClass(course.status);

    card.className = `course-card ${titleClass} ${statusClass}`;

    const start = course.start_time ? course.start_time.slice(11, 16) : "--:--";
    const end = course.end_time ? course.end_time.slice(11, 16) : "--:--";

    const roomName = course.rooms?.name || "Kein Raum";
    const branchName = course.rooms?.branches?.name || "Keine Filiale";

    const currentParticipants = course.current_participants ?? 0;
    const maxParticipants = course.max_participants ?? "-";
    const status = course.status || "-";

    // No class name displayed.
    // Trainer already knows this is their own plan.
    card.innerHTML = `
        <div class="course-title">${escapeHtml(roomName)}</div>
        <div class="course-meta">Studio: ${escapeHtml(branchName)}</div>
        <div class="course-meta">TN: ${currentParticipants}/${maxParticipants}</div>
        <div class="course-status">${escapeHtml(status)}</div>
    `;

    card.onclick = () => {
        alert(
            `${course.title}\n` +
            `${start} - ${end}\n` +
            `Raum: ${roomName}\n` +
            `Studio: ${branchName}\n` +
            `Teilnehmer: ${currentParticipants}/${maxParticipants}\n` +
            `Status: ${status}`
        );
    };

    return card;
}

function getCourseClass(title) {
    const normalizedTitle = String(title || "").toLowerCase();

    if (normalizedTitle.includes("pilates")) {
        return "pilates";
    }

    if (normalizedTitle.includes("yoga")) {
        return "yoga";
    }

    if (normalizedTitle.includes("spinning")) {
        return "spinning";
    }

    if (normalizedTitle.includes("kraft")) {
        return "krafttraining";
    }

    if (normalizedTitle.includes("functional")) {
        return "functional-fit";
    }

    return "";
}

function getStatusClass(status) {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") {
        return "canceled";
    }

    return "";
}

async function saveAbsence(e) {
    e.preventDefault();

    const reason = document.querySelector(".absence-form select").value;
    const fromDate = document.querySelectorAll(".absence-form input[type='date']")[0].value;
    const toDate = document.querySelectorAll(".absence-form input[type='date']")[1].value;
    const note = document.querySelector(".absence-form textarea").value.trim();

    if (!fromDate || !toDate) {
        alert("Bitte Von- und Bis-Datum auswählen.");
        return;
    }

    if (toDate < fromDate) {
        alert("Das Bis-Datum darf nicht vor dem Von-Datum liegen.");
        return;
    }

    const { error } = await supabaseClient
        .from("absences")
        .insert({
            trainer_id: trainerId,
            reason: note || reason,
            start_date: fromDate,
            end_date: toDate,
            start_time: "00:00",
            end_time: "23:59:59",
            status: reason
        });

    if (error) {
        console.log("Supabase Error:", error);
        alert(error.message);
        return;
    }

    alert("Abwesenheit gespeichert.");

    await loadAbsences();
    await loadTrainerWeeklySchedule();
}

async function loadAbsences() {
    const { data, error } = await supabaseClient
        .from("absences")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("start_date", { ascending: false });

    if (error) {
        console.log("Load absences error:", error);
        return;
    }

    const container = document.getElementById("absence-list");
    container.innerHTML = "";

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="absence-list-item">
                Noch keine Abwesenheiten gemeldet.
            </div>
        `;
        return;
    }

    data.forEach(absence => {
        container.innerHTML += `
            <div class="absence-list-item">
                <b>${escapeHtml(absence.status || "-")}</b><br>
                ${escapeHtml(absence.start_date)} bis ${escapeHtml(absence.end_date)}<br>
                ${escapeHtml(absence.reason || "")}
            </div>
        `;
    });
}

async function loadAbsencesForCurrentWeek() {
    const weekStart = formatDate(currentWeekStart);
    const weekAfter = formatDate(addDays(currentWeekStart, 7));

    const { data, error } = await supabaseClient
        .from("absences")
        .select("*")
        .eq("trainer_id", trainerId)
        .lte("start_date", weekAfter)
        .gte("end_date", weekStart);

    if (error) {
        console.log("Load weekly absences error:", error);
        return [];
    }

    return data || [];
}

document.querySelector(".absence-form").addEventListener("submit", saveAbsence);

document.getElementById("prevWeekBtn").onclick = async () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    await loadTrainerWeeklySchedule();
};

document.getElementById("nextWeekBtn").onclick = async () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    await loadTrainerWeeklySchedule();
};

document.getElementById("currentWeekBtn").onclick = async () => {
    currentWeekStart = getMonday(new Date());
    await loadTrainerWeeklySchedule();
};

buildTrainerScheduleHeader();
loadTrainerWeeklySchedule();
loadAbsences();