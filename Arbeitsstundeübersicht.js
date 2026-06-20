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

if (currentUser.role !== "admin") {
    alert("Diese Seite ist nur für Admins.");
    window.location.href = "login.html";
    throw new Error("Not admin");
}

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


async function loadWorkDetails() {
    const { data, error } = await supabaseClient
        .from("courses")
        .select(`
            title,
            start_time,
            end_time
        `);

    if (error) {
        console.log("Error:", error);
        return;
    }

    const detailsBody = document.getElementById("details-body");
    detailsBody.innerHTML = "";

    data.forEach(course => {
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
                <td>1 h</td>
                <td>—</td>
                <td>1 h</td>
            </tr>
        `;
    });
}

loadWorkDetails();