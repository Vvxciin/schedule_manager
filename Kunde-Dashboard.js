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
let allCourses = [];
let activeBookedCourseIds = new Set();

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

async function loadCourses() {
    const selectedDay = document.getElementById("dayFilter").value || dateKey(new Date());

    const dayStart = dateFromKey(selectedDay);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

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
        .gte("start_time", dayStart.toISOString())
        .lt("start_time", dayEnd.toISOString())
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Courses error:", error);
        return;
    }

    allCourses = data || [];

    populateStudioFilter(allCourses);
    applyCourseFilters();
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

    const courseEnd = new Date(course.end_time);

    if (courseEnd < new Date()) {
        alert("Dieser Kurs ist bereits vergangen.");
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

    const { error: updateError } = await supabaseClient
        .from("courses")
        .update({
            current_participants: course.current_participants + 1
        })
        .eq("id", courseId);

    if (updateError) {
        console.log(updateError);
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

    activeBookedCourseIds = new Set(
    (data || [])
        .map(booking => booking.courses?.id)
        .filter(Boolean)
    );

    applyCourseFilters();

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

    await supabaseClient
        .from("courses")
        .update({
            current_participants: Math.max(currentParticipants - 1, 0)
        })
        .eq("id", courseId);

    await createCustomerNotification("Eine Buchung wurde storniert.", "Stornierung");

    alert("Buchung storniert.");
    loadCourses();
    loadBookings();
    loadCustomerNotifications();
}


function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatTime(dateValue) {
    return new Date(dateValue).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function populateStudioFilter(courses) {
    const studioFilter = document.getElementById("studioFilter");
    const oldStudio = studioFilter.value;

    const studios = [...new Set(
        courses
            .map(course => course.rooms?.branches?.name)
            .filter(Boolean)
    )].sort();

    studioFilter.innerHTML = `
        <option value="">Alle Studios</option>
        ${studios.map(studio => `
            <option value="${escapeHTML(studio)}">${escapeHTML(studio)}</option>
        `).join("")}
    `;

    if ([...studioFilter.options].some(option => option.value === oldStudio)) {
        studioFilter.value = oldStudio;
    }
}

function formatDateTitle(key) {
    const date = dateFromKey(key);

    const today = new Date();

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const normalDate = date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

    if (key === dateKey(today)) {
        return `Heute, ${normalDate}`;
    }

    if (key === dateKey(tomorrow)) {
        return `Morgen, ${normalDate}`;
    }

    return normalDate;
}



function setupCourseFilters() {
    const searchInput = document.getElementById("courseSearchInput");
    const studioFilter = document.getElementById("studioFilter");
    const dayFilter = document.getElementById("dayFilter");
    const timeFilter = document.getElementById("timeFilter");
    const filterButton = document.getElementById("filterButton");
    const resetButton = document.getElementById("resetFilterButton");

    dayFilter.value = dateKey(new Date());

    searchInput.addEventListener("input", applyCourseFilters);
    studioFilter.addEventListener("change", applyCourseFilters);
    timeFilter.addEventListener("change", applyCourseFilters);
    filterButton.addEventListener("click", applyCourseFilters);

    dayFilter.addEventListener("change", () => {
        searchInput.value = "";
        studioFilter.value = "";
        timeFilter.value = "";
        loadCourses();
    });

    resetButton.addEventListener("click", () => {
        searchInput.value = "";
        studioFilter.value = "";
        timeFilter.value = "";
        dayFilter.value = dateKey(new Date());
        loadCourses();
    });
}

function applyCourseFilters() {
    const searchText = document.getElementById("courseSearchInput").value.toLowerCase().trim();
    const selectedStudio = document.getElementById("studioFilter").value;
    const selectedDay = document.getElementById("dayFilter").value;
    const selectedTime = document.getElementById("timeFilter").value;

    const filteredCourses = allCourses.filter(course => {
        const title = course.title || "";
        const trainer = course.trainers?.name || "";
        const room = course.rooms?.name || "";
        const studio = course.rooms?.branches?.name || "";

        const searchKitchen = `${title} ${trainer} ${room} ${studio}`.toLowerCase();

        if (searchText && !searchKitchen.includes(searchText)) {
            return false;
        }

        if (selectedStudio && studio !== selectedStudio) {
            return false;
        }

        const courseStart = new Date(course.start_time);

        if (selectedDay && dateKey(courseStart) !== selectedDay) {
            return false;
        }

        const hour = courseStart.getHours();

        if (selectedTime === "morning" && !(hour >= 6 && hour < 12)) {
            return false;
        }

        if (selectedTime === "afternoon" && !(hour >= 12 && hour < 17)) {
            return false;
        }

        if (selectedTime === "evening" && !(hour >= 17 && hour <= 23)) {
            return false;
        }

        return true;
    });

    renderCourses(filteredCourses);
}

function renderCourses(courses) {
    const coursesList = document.getElementById("courses-list");
    const titleElement = document.querySelector(".verfugbar_title");
    const selectedDay = document.getElementById("dayFilter").value;

    const todayKey = dateKey(new Date());

    if (selectedDay === todayKey) {
        titleElement.innerText = `Heutige verfügbare Kurse — ${formatDateTitle(selectedDay)}`;
    } else {
        titleElement.innerText = `Verfügbare Kurse — ${formatDateTitle(selectedDay)}`;
    }

    coursesList.innerHTML = "";

    if (!courses || courses.length === 0) {
        coursesList.innerHTML = `
            <div class="empty-courses">
                Keine Kurse gefunden.
            </div>
        `;
        return;
    }

    courses.forEach(course => {
        const start = new Date(course.start_time);
        const end = new Date(course.end_time);

        const current = Number(course.current_participants || 0);
        const max = Number(course.max_participants || 0);
        const percent = max > 0 ? Math.min((current / max) * 100, 100) : 0;

        const status = String(course.status || "scheduled").toLowerCase();
        const now = new Date();
        const isPassed = end < now;

        const isCancelled =
            status === "canceled" ||
            status === "cancelled" ||
            status === "ausgefallen";

        const isFull = max > 0 && current >= max;
        const isBooked = activeBookedCourseIds.has(course.id);

        let badgeText = "Verfügbar";
        let badgeClass = "badge-green";
        let buttonText = "Buchen";

        if (isPassed) {
            badgeText = "Vergangen";
            badgeClass = "badge-gray";
            buttonText = "Vergangen";
        } else if (isCancelled) {
            badgeText = "Ausgefallen";
            badgeClass = "badge-red";
            buttonText = "Ausgefallen";
        } else if (isFull) {
            badgeText = "Voll";
            badgeClass = "badge-red";
            buttonText = "Voll";
        } else if (isBooked) {
            badgeText = "Gebucht";
            badgeClass = "badge-blue";
            buttonText = "Gebucht";
        }

        const buttonDisabled = isPassed || isCancelled || isFull || isBooked;

        const dateText = selectedDay
            ? ""
            : `${start.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit"
            })} · `;

        coursesList.innerHTML += `
            <div class="course-row ${isCancelled ? "course-cancelled" : ""}">
                <div class="course-info">
                    <h3 class="course-title">${escapeHTML(course.title)}</h3>

                    <p class="course-meta">
                        ${dateText}${formatTime(start)} - ${formatTime(end)}
                        · ${escapeHTML(course.trainers?.name || "-")}
                        · ${escapeHTML(course.rooms?.name || "-")}, ${escapeHTML(course.rooms?.branches?.name || "-")}
                    </p>

                    <div class="course-capacity-line">
                        <div class="capacity-bar">
                            <span 
                                class="capacity-bar-fill ${isCancelled ? "fill-red" : isFull ? "fill-red" : "fill-green"}"
                                style="width: ${percent}%"
                            ></span>
                        </div>

                        <span class="capacity-text">
                            ${current}/${max} Plätze belegt
                        </span>

                        <span class="course-badge ${badgeClass}">
                            ${badgeText}
                        </span>
                    </div>
                </div>

                <div class="course-action">
                    <button 
                        class="course-book-btn"
                        onclick="bookCourse('${course.id}')"
                        ${buttonDisabled ? "disabled" : ""}
                    >
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    });
}

setupCourseFilters();

loadCourses();
loadBookings();
loadCustomerNotifications();