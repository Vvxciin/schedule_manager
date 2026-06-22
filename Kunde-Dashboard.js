const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    alert("Bitte zuerst einloggen.");
    window.location.href = "login.html";
}

if (currentUser.role !== "customer") {
    alert("Diese Seite ist nur für Kunden.");
    window.location.href = "login.html";
}

const CURRENT_CUSTOMER_ID = currentUser.id;
let coursesPage = 0;
const COURSES_PER_PAGE = 60;
let loadedCourses = [];

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


async function createCustomerNotification(message, type = "Buchung") {
    const { error } = await supabaseClient
        .from("notifications")
        .insert({
            user_id: CURRENT_CUSTOMER_ID,
            message: message,
            type: type,
            is_read: false
        });

    if (error) {
        console.log("Create customer notification error:", error);
    }
}

async function loadCustomerNotifications() {
    const { data, error } = await supabaseClient
        .from("notifications")
        .select("id, message, type, created_at")
        .eq("user_id", CURRENT_CUSTOMER_ID)
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        console.log("Customer notification error:", error);
        return;
    }

    const notificationsList = document.getElementById("notifications-list");

    if (!notificationsList) {
        return;
    }

    notificationsList.innerHTML = "";

    if (!data || data.length === 0) {
        notificationsList.innerHTML = `
            <div class="booking-card">
                Keine Benachrichtigungen.
            </div>
        `;
        return;
    }

    data.forEach(notification => {
        const date = new Date(notification.created_at).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });

        notificationsList.innerHTML += `
            <div class="booking-card">
                <p><b>${notification.type || "Info"}</b></p>
                <p>${notification.message}</p>
                <p>${date}</p>
            </div>
        `;
    });
}

async function loadCourses(reset = true) {
    if (reset) {
        coursesPage = 0;
        loadedCourses = [];
    }

    const now = new Date().toISOString();
    const from = coursesPage * COURSES_PER_PAGE;
    const to = from + COURSES_PER_PAGE - 1;

    const { data, error } = await supabaseClient
        .from("courses")
        .select(`
            id,
            title,
            start_time,
            end_time,
            max_participants,
            current_participants,
            status,
            trainers(name),
            rooms(name, branches(name))
        `)
        .eq("status", "scheduled")
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .range(from, to);

    if (error) {
        console.log("Courses error:", error);
        return;
    }

    loadedCourses = loadedCourses.concat(data || []);
    renderCourses(data && data.length === COURSES_PER_PAGE);

    coursesPage++;
}

function renderCourses(hasMore) {
    const coursesList = document.getElementById("courses-list");

    if (!loadedCourses || loadedCourses.length === 0) {
        coursesList.innerHTML = `<div class="course-card">Keine verfügbaren Kurse.</div>`;
        return;
    }

    const html = loadedCourses.map(course => {
        const start = new Date(course.start_time).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });

        const end = new Date(course.end_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        const isFull = course.current_participants >= course.max_participants;

        return `
            <div class="course-card">
                <h3>${course.title}</h3>
                <p><b>Zeit:</b> ${start} - ${end}</p>
                <p><b>Trainer:</b> ${course.trainers?.name || "-"}</p>
                <p><b>Studio:</b> ${course.rooms?.branches?.name || "-"}</p>
                <p><b>Raum:</b> ${course.rooms?.name || "-"}</p>
                <p><b>Teilnehmer:</b> ${course.current_participants}/${course.max_participants}</p>

                <button onclick="bookCourse('${course.id}')" ${isFull ? "disabled" : ""}>
                    ${isFull ? "Ausgebucht" : "Buchen"}
                </button>
            </div>
        `;
    }).join("");

    coursesList.innerHTML = html + (hasMore ? `
        <button class="load-more-button" onclick="loadCourses(false)">
            Mehr Kurse laden
        </button>
    ` : "");
}

async function bookCourse(courseId) {
    const { data: course, error: courseError } = await supabaseClient
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

    if (courseError) {
        alert("Kurs konnte nicht geladen werden.");
        console.log(courseError);
        return;
    }

    if (course.current_participants >= course.max_participants) {
        alert("Dieser Kurs ist bereits voll.");
        return;
    }

    const hasOverlap = await customerHasOverlappingBooking(course.start_time, course.end_time);

    if (hasOverlap) {
        alert("Du hast bereits eine Buchung in diesem Zeitraum.");
        return;
    }

const { data: oldBooking } = await supabaseClient
    .from("bookings")
    .select("id, status")
    .eq("customer_id", CURRENT_CUSTOMER_ID)
    .eq("course_id", courseId)
    .maybeSingle();

let bookingError = null;

if (oldBooking) {
    const result = await supabaseClient
        .from("bookings")
        .update({ status: "active" })
        .eq("id", oldBooking.id);

    bookingError = result.error;
} else {
    const result = await supabaseClient
        .from("bookings")
        .insert({
            customer_id: CURRENT_CUSTOMER_ID,
            course_id: courseId,
            status: "active"
        });

    bookingError = result.error;
}

if (bookingError) {
    alert("Buchung fehlgeschlagen.");
    console.log(bookingError);
    return;
}



    await createCustomerNotification(`Du hast den Kurs ${course.title} gebucht.`, "Buchung");

    alert("Kurs erfolgreich gebucht!");
    loadCourses();
    loadBookings();
    loadCustomerNotifications();
}

async function customerHasOverlappingBooking(newStart, newEnd) {
    const { data, error } = await supabaseClient
        .from("bookings")
        .select(`
            id,
            courses(start_time, end_time)
        `)
        .eq("customer_id", CURRENT_CUSTOMER_ID)
        .eq("status", "active");

    if (error) {
        console.log("Overlap check error:", error);
        return false;
    }

    const startA = new Date(newStart);
    const endA = new Date(newEnd);

    return data.some(booking => {
        const startB = new Date(booking.courses.start_time);
        const endB = new Date(booking.courses.end_time);

        return startA < endB && endA > startB;
    });
}

async function loadBookings() {
    const { data, error } = await supabaseClient
        .from("bookings")
        .select(`
            id,
            status,
            courses(
                id,
                title,
                start_time,
                end_time,
                current_participants,
                rooms(name, branches(name))
            )
        `)
        .eq("customer_id", CURRENT_CUSTOMER_ID)
        .eq("status", "active");

    if (error) {
        console.log("Bookings error:", error);
        return;
    }

    const bookingsList = document.getElementById("bookings-list");
    bookingsList.innerHTML = "";

    data.forEach(booking => {
        const course = booking.courses;

        const start = new Date(course.start_time).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });

        bookingsList.innerHTML += `
            <div class="booking-card">
                <p><b>${course.title}</b></p>
                <p>${start}</p>
                <p>${course.rooms?.branches?.name || "-"} / ${course.rooms?.name || "-"}</p>

                <button onclick="cancelBooking('${booking.id}', '${course.id}', ${course.current_participants})">
                    Stornieren
                </button>
            </div>
        `;
    });
}

async function cancelBooking(bookingId, courseId, currentParticipants) {
    const { error: bookingError } = await supabaseClient
        .from("bookings")
        .update({ status: "canceled" })
        .eq("id", bookingId);

    if (bookingError) {
        alert("Stornierung fehlgeschlagen.");
        console.log(bookingError);
        return;
    }



    await createCustomerNotification("Eine Buchung wurde storniert.", "Stornierung");

    alert("Buchung storniert.");
    loadCourses();
    loadBookings();
    loadCustomerNotifications();
}

loadCourses();
loadBookings();
loadCustomerNotifications();