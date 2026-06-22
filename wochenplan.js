const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase connected!");


// Admin protection
const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    alert("Bitte zuerst einloggen.");
    window.location.href = "login.html";
    throw new Error("Not logged in");
}

if (currentUser.role !== "admin") {
    alert("Diese Seite ist nur für Admins.");
    window.location.href = "login.html";
    throw new Error("Not admin");
}


// Profile box
function setupProfileBox() {
    const profileBtn = document.getElementById("profileBtn");
    const profileBox = document.getElementById("profileBox");
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const logoutBtn = document.getElementById("logoutBtn");

    profileName.innerText = `Name: ${currentUser.name || "-"}`;
    profileRole.innerText = `Rolle: ${currentUser.role || "-"}`;

    profileBtn.onclick = () => {
        profileBox.style.display =
            profileBox.style.display === "block" ? "none" : "block";
    };

    logoutBtn.onclick = () => {
        localStorage.removeItem("currentUser");
        window.location.href = "login.html";
    };
}

setupProfileBox();


// Week setup
let currentWeekStart = getMonday(new Date());
let editingCourseId = null;
let trainersCache = [];
let roomsCache = [];

const days = [
    { label: "Mo", offset: 0 },
    { label: "Di", offset: 1 },
    { label: "Mi", offset: 2 },
    { label: "Do", offset: 3 },
    { label: "Fr", offset: 4 },
    { label: "Sa", offset: 5 }
];

const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];


// Room order inside every time block
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


// Date helpers
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay(); // Sunday = 0, Monday = 1
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


// Status box
function setStatus(message, type = "success") {
    const statusCard = document.getElementById("statusCard");
    const statusText = document.getElementById("statusText");

    statusCard.classList.remove("error", "warning");

    if (type === "error") {
        statusCard.classList.add("error");
    }

    if (type === "warning") {
        statusCard.classList.add("warning");
    }

    statusText.innerText = message;
}


// Labels
function updateWeekLabels() {
    const weekPicker = document.getElementById("weekPicker");
    const weekLabel = document.getElementById("weekLabel");

    const weekEnd = addDays(currentWeekStart, 5);

    weekPicker.value = formatDate(currentWeekStart);
    weekLabel.innerText =
        `${formatGermanDate(currentWeekStart)} - ${formatGermanDate(weekEnd)}`;
}


// Build table header
function buildScheduleHeader() {
    const scheduleHead = document.getElementById("scheduleHead");

    let html = `
        <tr>
            <th>Tag</th>
    `;

    hours.forEach(hour => {
        html += `<th>${hour} - ${hour + 1}</th>`;
    });

    html += `</tr>`;

    scheduleHead.innerHTML = html;
}


// Load weekly courses
async function loadWeeklySchedule() {
    updateWeekLabels();

    const weekStart = formatDate(currentWeekStart);
    const weekAfter = formatDate(addDays(currentWeekStart, 7));

    setStatus("Wochenplan wird geladen...", "warning");

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
            trainers (
                name
            ),
            rooms (
                name,
                branch_id,
                branches (
                    name
                )
            )
        `)
        .gte("start_time", weekStart + "T00:00:00")
        .lt("start_time", weekAfter + "T00:00:00")
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Load weekly schedule error:", error);
        setStatus("Wochenplan konnte nicht geladen werden.", "error");
        alert("Wochenplan konnte nicht geladen werden.");
        return;
    }

    renderSchedule(data || []);

    document.getElementById("courseCountLabel").innerText =
        `${data ? data.length : 0} Kurse geladen`;

    setStatus("Wochenplan geladen.");
}


// Render schedule table
function renderSchedule(courses) {
    const scheduleBody = document.getElementById("scheduleBody");
    scheduleBody.innerHTML = "";

    days.forEach(day => {
        const row = document.createElement("tr");

        const dayCell = document.createElement("th");
        dayCell.className = "day-cell";
        dayCell.innerText = day.label;
        row.appendChild(dayCell);

        const currentDayDate = formatDate(addDays(currentWeekStart, day.offset));

        hours.forEach(hour => {
            const cell = document.createElement("td");
            cell.className = "time-cell empty-cell";

            const coursesForCell = courses
                .filter(course => {
                    if (!course.start_time) {
                        return false;
                    }

                    const courseDate = course.start_time.slice(0, 10);
                    const courseHour = Number(course.start_time.slice(11, 13));

                    return courseDate === currentDayDate && courseHour === hour;
                })
                .sort((a, b) => {
                    return getRoomRank(a) - getRoomRank(b);
                });

            if (coursesForCell.length > 0) {
                cell.classList.remove("empty-cell");
            }

            coursesForCell.forEach(course => {
                cell.appendChild(createCourseCard(course));
            });

            row.appendChild(cell);
        });

        scheduleBody.appendChild(row);
    });
}


// Course card
function createCourseCard(course) {
    const card = document.createElement("div");

    const titleClass = getCourseClass(course.title);
    const statusClass = getStatusClass(course.status);

    card.className = `course-card ${titleClass} ${statusClass}`;

    const start = course.start_time ? course.start_time.slice(11, 16) : "--:--";
    const end = course.end_time ? course.end_time.slice(11, 16) : "--:--";

    const trainerName = course.trainers?.name || "Kein Trainer";
    const roomName = course.rooms?.name || "Kein Raum";
    const branchName = course.rooms?.branches?.name || "Keine Filiale";

    const currentParticipants = course.current_participants ?? 0;
    const maxParticipants = course.max_participants ?? "-";
    const status = course.status || "-";

    card.innerHTML = `
        <div class="course-title">${escapeHtml(trainerName)}</div>
       
        <div class="course-meta">Raum: ${escapeHtml(roomName)}</div>
        <div class="course-meta">Studio: ${escapeHtml(branchName)}</div>
        <div class="course-meta">TN: ${currentParticipants}/${maxParticipants}</div>
        <div class="course-status">Status: ${escapeHtml(status)}</div>
    `;

    card.onclick = () => {
    openCourseEditModal(course);
};

    return card;
}


// Course colors
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


// Generate selected week
async function generateSelectedWeek() {
    const weekStart = formatDate(currentWeekStart);
    const fillProbability = Number(document.getElementById("fillProbability").value);

    console.log("Calling RPC with:", {
        p_week_start: weekStart,
        p_fill_probability: fillProbability
    });

    const { data, error } = await supabaseClient.rpc(
        "generate_weekly_schedule_auto",
        {
            p_week_start: weekStart,
            p_fill_probability: fillProbability
        }
    );

    console.log("RPC data:", data);
    console.log("RPC error:", error);

    if (error) {
        alert("RPC Fehler: " + error.message);
        return;
    }

    alert("Wochenplan generiert!");
    await loadWeeklySchedule();
}


// Events

async function loadEditModalData() {
    const { data: trainers, error: trainerError } = await supabaseClient
        .from("trainers")
        .select("id, name")
        .order("name", { ascending: true });

    if (trainerError) {
        console.log("Load trainers error:", trainerError);
        alert("Trainer konnten nicht geladen werden.");
        return;
    }

    const { data: rooms, error: roomError } = await supabaseClient
        .from("rooms")
        .select(`
            id,
            name,
            branches (
                name
            )
        `)
        .order("name", { ascending: true });

    if (roomError) {
        console.log("Load rooms error:", roomError);
        alert("Räume konnten nicht geladen werden.");
        return;
    }

    trainersCache = trainers || [];
    roomsCache = rooms || [];

    const trainerSelect = document.getElementById("editCourseTrainer");
    const roomSelect = document.getElementById("editCourseRoom");

    trainerSelect.innerHTML = "";
    roomSelect.innerHTML = "";

    trainersCache.forEach(trainer => {
        trainerSelect.innerHTML += `
            <option value="${trainer.id}">
                ${escapeHtml(trainer.name || "-")}
            </option>
        `;
    });

    roomsCache.forEach(room => {
        trainerSelect;
        roomSelect.innerHTML += `
            <option value="${room.id}">
                ${escapeHtml(room.name || "-")} - ${escapeHtml(room.branches?.name || "Keine Filiale")}
            </option>
        `;
    });
}

async function openCourseEditModal(course) {
    editingCourseId = course.id;

    await loadEditModalData();

    document.getElementById("editCourseTitle").value = course.title || "Yoga";
    document.getElementById("editCourseTrainer").value = course.trainer_id || "";
    document.getElementById("editCourseRoom").value = course.room_id || "";

    const startDate = new Date(course.start_time);

    document.getElementById("editCourseDate").value =
        course.start_time.slice(0, 10);

    document.getElementById("editCourseStartTime").value =
        startDate.toTimeString().slice(0, 5);

    document.getElementById("editCourseStatus").value =
        course.status || "scheduled";

    document.getElementById("courseEditModal").style.display = "block";
}

function closeCourseEditModal() {
    editingCourseId = null;
    document.getElementById("courseEditModal").style.display = "none";
}

async function saveEditedCourse() {
    if (!editingCourseId) {
        alert("Kein Kurs ausgewählt.");
        return;
    }

    const title = document.getElementById("editCourseTitle").value;
    const trainerId = document.getElementById("editCourseTrainer").value;
    const roomId = document.getElementById("editCourseRoom").value;
    const courseDate = document.getElementById("editCourseDate").value;
    const startTimeValue = document.getElementById("editCourseStartTime").value;
    const status = document.getElementById("editCourseStatus").value;

    if (!title || !trainerId || !roomId || !courseDate || !startTimeValue) {
        alert("Bitte alle Kursdaten ausfüllen.");
        return;
    }

    const startTime = `${courseDate}T${startTimeValue}:00`;

    const startDate = new Date(startTime);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    const endTime =
        `${courseDate}T${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`;

    const { error } = await supabaseClient
        .from("courses")
        .update({
            title: title,
            trainer_id: trainerId,
            room_id: roomId,
            start_time: startTime,
            end_time: endTime,
            status: status
        })
        .eq("id", editingCourseId);

    if (error) {
        console.log("Update course error:", error);

        if (error.message && error.message.includes("weekly contract hours")) {
            alert("Der Kurs überschreitet die Wochenstunden dieses Trainers.");
        } else if (error.message && error.message.includes("nicht verfügbar")) {
            alert("Der Trainer ist zu dieser Zeit nicht verfügbar/abwesend.");
        } else if (error.message && error.message.includes("room")) {
            alert("Der Raum ist zu dieser Zeit schon belegt.");
        } else {
            alert("Kurs konnte nicht aktualisiert werden: " + error.message);
        }

        return;
    }

    alert("Kurs aktualisiert.");
    closeCourseEditModal();
    await loadWeeklySchedule();
}

async function deleteEditedCourse() {
    if (!editingCourseId) {
        alert("Kein Kurs ausgewählt.");
        return;
    }

    const confirmed = confirm("Diesen Kurs wirklich absagen?");

    if (!confirmed) {
        return;
    }

    const { error } = await supabaseClient
        .from("courses")
        .update({
            status: "canceled"
        })
        .eq("id", editingCourseId);

    if (error) {
        console.log("Cancel course error:", error);
        alert("Kurs konnte nicht abgesagt werden: " + error.message);
        return;
    }

    alert("Kurs wurde abgesagt.");
    closeCourseEditModal();
    await loadWeeklySchedule();
}

document.getElementById("prevWeekBtn").onclick = async () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    await loadWeeklySchedule();
};

document.getElementById("nextWeekBtn").onclick = async () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    await loadWeeklySchedule();
};

document.getElementById("todayWeekBtn").onclick = async () => {
    currentWeekStart = getMonday(new Date());
    await loadWeeklySchedule();
};

document.getElementById("loadWeekBtn").onclick = async () => {
    const chosenDate = document.getElementById("weekPicker").value;

    if (!chosenDate) {
        alert("Bitte Datum auswählen.");
        return;
    }

    currentWeekStart = getMonday(new Date(chosenDate + "T00:00:00"));
    await loadWeeklySchedule();
};

document.getElementById("generateWeekBtn").onclick = generateSelectedWeek;

document.getElementById("weekPicker").onchange = async () => {
    const chosenDate = document.getElementById("weekPicker").value;

    if (!chosenDate) {
        return;
    }

    currentWeekStart = getMonday(new Date(chosenDate + "T00:00:00"));
    await loadWeeklySchedule();
};


// Start
document.getElementById("saveEditCourseBtn").onclick = saveEditedCourse;
document.getElementById("deleteEditCourseBtn").onclick = deleteEditedCourse;
document.getElementById("closeEditCourseBtn").onclick = closeCourseEditModal;

window.onclick = (event) => {
    const modal = document.getElementById("courseEditModal");

    if (event.target === modal) {
        closeCourseEditModal();
    }
};
buildScheduleHeader();
loadWeeklySchedule();

function setupNotificationBell() {
    const bellBtn = document.getElementById("notificationBtn");
    const dropdown = document.getElementById("notificationDropdown");
    const list = document.getElementById("notificationDropdownList");

    if (!bellBtn || !dropdown || !list) return;

    bellBtn.onclick = async (event) => {
        event.stopPropagation();
        dropdown.classList.toggle("show");

        if (!dropdown.classList.contains("show")) return;

        const { data, error } = await supabaseClient
            .from("notifications")
            .select("message, type, created_at")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.log("Notification dropdown error:", error);
            list.innerHTML = "<p>Fehler beim Laden.</p>";
            return;
        }

        if (!data || data.length === 0) {
            list.innerHTML = "<p>Keine Benachrichtigungen.</p>";
            return;
        }

        list.innerHTML = data.map(notification => {
            const date = new Date(notification.created_at).toLocaleString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });

            return `
                <div class="notification-dropdown-item">
                    <div class="notification-dropdown-type">${notification.type || "Info"}</div>
                    <div>${notification.message}</div>
                    <div class="notification-dropdown-date">${date}</div>
                </div>
            `;
        }).join("");
    };

    document.addEventListener("click", () => {
        dropdown.classList.remove("show");
    });

    dropdown.onclick = (event) => {
        event.stopPropagation();
    };
}

setupNotificationBell();