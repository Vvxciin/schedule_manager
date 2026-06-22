const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    alert("Bitte zuerst einloggen.");
    window.location.href = "login.html";
}

if (currentUser.role !== "trainer") {
    alert("Diese Seite ist nur für Trainer.");
    window.location.href = "login.html";
}

const CURRENT_TRAINER_ID = currentUser.id;

function setupProfileBox() {
    const profileBtn = document.getElementById("profileBtn");
    const profileBox = document.getElementById("profileBox");
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const logoutBtn = document.getElementById("logoutBtn");

    profileName.innerText = `Name: ${currentUser.name}`;
    profileRole.innerText = `Rolle: ${currentUser.role}`;

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
setupNotificationBell();

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
            .eq("user_id", CURRENT_TRAINER_ID)
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

function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
}

function weekRange() {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
}

function formatTime(value) {
    return new Date(value).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function loadSchedule() {
    const { start, end } = todayRange();

    const { data, error } = await supabaseClient
        .from("courses")
        .select(`
            title,
            start_time,
            end_time,
            rooms (
                name,
                branches (
                    name
                )
            )
        `)
        .eq("trainer_id", CURRENT_TRAINER_ID)
        .gte("start_time", start)
        .lt("start_time", end)
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Schedule error:", error);
        return;
    }

    const scheduleBody = document.getElementById("schedule-body");
    scheduleBody.innerHTML = "";

    if (!data || data.length === 0) {
        scheduleBody.innerHTML = `
            <tr>
                <td colspan="4">Keine Kurse heute.</td>
            </tr>
        `;
        return;
    }

    data.forEach(course => {
        const roomName = course.rooms?.name || "-";
        const branchName = course.rooms?.branches?.name || "-";

        scheduleBody.innerHTML += `
            <tr>
                <td>${formatTime(course.start_time)} - ${formatTime(course.end_time)}</td>
                <td>${course.title}</td>
                <td>${branchName}</td>
                <td>${roomName}</td>
            </tr>
        `;
    });
}

async function loadDashboardInfo() {
    const today = todayRange();
    const week = weekRange();

    const { data: trainer } = await supabaseClient
        .from("trainers")
        .select("working_hours")
        .eq("id", CURRENT_TRAINER_ID)
        .single();

    const { data: todayCourses, error: todayError } = await supabaseClient
        .from("courses")
        .select(`
            start_time,
            end_time,
            rooms (
                branches (
                    name
                )
            )
        `)
        .eq("trainer_id", CURRENT_TRAINER_ID)
        .gte("start_time", today.start)
        .lt("start_time", today.end);

    if (todayError) {
        console.log("Today courses error:", todayError);
        return;
    }

    document.getElementById("todayCourses").innerText = todayCourses?.length || 0;

    const locations = new Set();

    (todayCourses || []).forEach(course => {
        const branchName = course.rooms?.branches?.name;
        if (branchName) locations.add(branchName);
    });

    document.getElementById("todayLocations").innerText = locations.size;

    const { data: weekCourses, error: weekError } = await supabaseClient
        .from("courses")
        .select("start_time, end_time")
        .eq("trainer_id", CURRENT_TRAINER_ID)
        .gte("start_time", week.start)
        .lt("start_time", week.end);

    if (weekError) {
        console.log("Week courses error:", weekError);
        return;
    }

    let workedHours = 0;

    (weekCourses || []).forEach(course => {
        const start = new Date(course.start_time);
        const end = new Date(course.end_time);

        if (!isNaN(start) && !isNaN(end)) {
            workedHours += (end - start) / (1000 * 60 * 60);
        }
    });

    const maxHours = trainer?.working_hours || "XX";

    document.getElementById("weeklyHours").innerText =
        `${workedHours}/${maxHours}`;

    await loadNotifications();
}

async function loadNotifications() {
    const { data, error } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("user_id", CURRENT_TRAINER_ID)
        .order("created_at", { ascending: false })
        .limit(5);

    const unreadElement = document.getElementById("unreadNotifications");
    const listElement = document.getElementById("notificationsList");

    if (error) {
        console.log("Notifications error:", error);
        unreadElement.innerText = "0";
        listElement.innerHTML = "<p>Fehler beim Laden der Benachrichtigungen.</p>";
        return;
    }

    const unreadCount = (data || []).filter(n => n.is_read === false).length;
    unreadElement.innerText = unreadCount;

    if (!data || data.length === 0) {
        listElement.innerHTML = "<p>Keine Benachrichtigungen.</p>";
        return;
    }

    listElement.innerHTML = "";

    data.forEach(notification => {
        listElement.innerHTML += `
            <div class="notification-item">
                ${notification.message}
            </div>
        `;
    });
}

loadSchedule();
loadDashboardInfo();