const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Temporary fixed customer for testing.
// Later you can replace this with login/current user.
const CURRENT_CUSTOMER_ID = "18e6f568-2c9c-4564-87d6-b8da6d2f1198";

async function loadCourses() {
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
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Courses error:", error);
        return;
    }

    const coursesList = document.getElementById("courses-list");
    coursesList.innerHTML = "";

    data.forEach(course => {
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

        coursesList.innerHTML += `
            <div class="course-card">
                <h3>${course.title}</h3>
                <p><b>Zeit:</b> ${start} - ${end}</p>
                <p><b>Trainer:</b> ${course.trainers?.name || "-"}</p>
                <p><b>Studio:</b> ${course.rooms?.branches?.name || "-"}</p>
                <p><b>Raum:</b> ${course.rooms?.name || "-"}</p>
                <p><b>Teilnehmer:</b> ${course.current_participants}/${course.max_participants}</p>

                <button 
                    onclick="bookCourse('${course.id}')"
                    ${isFull ? "disabled" : ""}
                >
                    ${isFull ? "Ausgebucht" : "Buchen"}
                </button>
            </div>
        `;
    });
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

    const { error: updateError } = await supabaseClient
        .from("courses")
        .update({
            current_participants: course.current_participants + 1
        })
        .eq("id", courseId);

    if (updateError) {
        console.log(updateError);
    }

    alert("Kurs erfolgreich gebucht!");
    loadCourses();
    loadBookings();
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

    await supabaseClient
        .from("courses")
        .update({
            current_participants: Math.max(currentParticipants - 1, 0)
        })
        .eq("id", courseId);

    alert("Buchung storniert.");
    loadCourses();
    loadBookings();
}

loadCourses();
loadBookings();