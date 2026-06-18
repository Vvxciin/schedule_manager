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

async function loadSchedule() {
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
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Error:", error);
        return;
    }

    const scheduleBody = document.getElementById("schedule-body");
    scheduleBody.innerHTML = "";

    if (!data || data.length === 0) {
        scheduleBody.innerHTML = `
            <tr>
                <td colspan="4">Keine Kurse für diesen Trainer.</td>
            </tr>
        `;
        return;
    }

    data.forEach(course => {
        const start = new Date(course.start_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        const end = new Date(course.end_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        const roomName = course.rooms?.name || "-";
        const branchName = course.rooms?.branches?.name || "-";

        scheduleBody.innerHTML += `
            <tr>
                <td>${start} - ${end}</td>
                <td>${course.title}</td>
                <td>${branchName}</td>
                <td>${roomName}</td>
            </tr>
        `;
    });
}

loadSchedule();

async function loadDashboardInfo() {
    // trainer info
    const { data: trainer } = await supabaseClient
        .from("trainers")
        .select("working_hours")
        .eq("id", CURRENT_TRAINER_ID)
        .single();

    // all courses for this trainer
    const { data: courses, error: courseError } = await supabaseClient
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
        .eq("trainer_id", CURRENT_TRAINER_ID);

    if (courseError) {
        console.log("Course info error:", courseError);
        return;
    }

    document.getElementById("todayCourses").innerText = courses.length;

    const locations = new Set();

    let workedHours = 0;

    courses.forEach(course => {
        const branchName = course.rooms?.branches?.name;
        if (branchName) {
            locations.add(branchName);
        }

        const start = new Date(course.start_time);
        const end = new Date(course.end_time);

        if (!isNaN(start) && !isNaN(end)) {
            workedHours += (end - start) / (1000 * 60 * 60);
        }
    });

    document.getElementById("todayLocations").innerText = locations.size;

    const maxHours = trainer?.working_hours || "XX";

    document.getElementById("weeklyHours").innerText =
        `${workedHours}/${maxHours}`;

    const { count } = await supabaseClient
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", CURRENT_TRAINER_ID)
        .eq("is_read", false);

    document.getElementById("unreadNotifications").innerText = count || 0;
}

loadDashboardInfo();