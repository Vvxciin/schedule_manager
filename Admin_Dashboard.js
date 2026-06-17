const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase connected!");


let editingTrainerId = null;
let editingCourseId = null;




function openCourseEditModal(course) {

    editingCourseId = course.id;

    document.getElementById("courseTitle").value =
        course.title;

    document.getElementById("courseTrainer").value =
        course.trainer_id;

    document.getElementById("courseRoom").value =
        course.room_id;

    const startDate =
        new Date(course.start_time);

    document.getElementById("courseDate").value =
        startDate.toISOString().split("T")[0];

    document.getElementById("courseStartTime").value =
        startDate.toTimeString().slice(0,5);

    openModal("courseModal");
}

function openModal(id) {
    document.getElementById(id).style.display = "block";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

function clearTrainerForm() {
    editingTrainerId = null;

    document.getElementById("trainerModalTitle").innerText = "Trainer hinzufügen";
    document.getElementById("trainerName").value = "";
    document.getElementById("trainerEmail").value = "";
    document.getElementById("trainerPhone").value = "";
    document.getElementById("trainerAvailability").value = "Vollzeit";
}

function openTrainerCreateModal() {
    clearTrainerForm();
    openModal("trainerModal");
}

function openTrainerEditModal(trainer) {
    editingTrainerId = trainer.id;

    document.getElementById("trainerModalTitle").innerText = "Trainer bearbeiten";
    document.getElementById("trainerName").value = trainer.name || "";
    document.getElementById("trainerEmail").value = trainer.email || "";
    document.getElementById("trainerPhone").value = trainer.phone_number || "";
    document.getElementById("trainerAvailability").value = trainer.availability || "Vollzeit";

    openModal("trainerModal");
}

document.getElementById("openTrainerModal").onclick = openTrainerCreateModal;
document.getElementById("openCustomerModal").onclick = () => openModal("customerModal");
document.getElementById("openCourseModal").onclick = () => openModal("courseModal");

document.querySelectorAll(".closeModalBtn").forEach(button => {
    button.onclick = () => closeModal(button.dataset.modal);
});

async function loadTrainers() {
    const { data, error } = await supabaseClient
        .from("trainers")
        .select("id, name, email, phone_number, working_hours, availability")
        .order("name", { ascending: true });

    if (error) {
        console.log("Trainer Error:", error);
        return;
    }

    const trainerBody = document.getElementById("trainer-body");
    const courseTrainer = document.getElementById("courseTrainer");

    trainerBody.innerHTML = "";
    courseTrainer.innerHTML = "";

    data.forEach(trainer => {
        const safeTrainer = JSON.stringify(trainer).replaceAll("'", "&apos;");

        trainerBody.innerHTML += `
            <tr>
                <td>${trainer.name}</td>
                <td>${trainer.availability || "-"}</td>
                <td>${trainer.working_hours || "-"} h</td>
                <td>aktiv</td>
                <td>
                    <button onclick='openTrainerEditModal(${safeTrainer})'>
                        Bearbeiten
                    </button>
                </td>
            </tr>
        `;

        courseTrainer.innerHTML += `
            <option 
                value="${trainer.id}" 
                data-availability="${trainer.availability || ""}"
                data-working-hours="${trainer.working_hours || 0}">
                ${trainer.name} (${trainer.availability || "-"})
            </option>
        `;
    });
}

async function loadRooms() {
    const { data, error } = await supabaseClient
        .from("rooms")
        .select(`
            id,
            name,
            branches (
                name
            )
        `)
        .order("name", { ascending: true });

    if (error) {
        console.log("Room Error:", error);
        return;
    }

    const courseRoom = document.getElementById("courseRoom");
    courseRoom.innerHTML = "";

    data.forEach(room => {
        courseRoom.innerHTML += `
            <option value="${room.id}">
                ${room.name} - ${room.branches?.name || "Kein Studio"}
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
                branches (
                    name
                )
            )
        `)
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Course Error:", error);
        return;
    }

    const courseBody = document.getElementById("course-body");
    courseBody.innerHTML = "";

    data.forEach(course => {
        const start = course.start_time.slice(11, 16);
        const end = course.end_time.slice(11, 16);

        courseBody.innerHTML += `
            <tr>
                <td>${start} - ${end}</td>
                <td>${course.title}</td>
                <td>${course.trainers?.name || "-"}</td>
                <td>${course.rooms?.name || "-"}</td>
                <td>${course.rooms?.branches?.name || "-"}</td>
                <td>${course.current_participants}/${course.max_participants}</td>
                <td>${course.status}</td>
                <td><button onclick='openCourseEditModal(${JSON.stringify(course)})'>Bearbeiten</button></td>
            </tr>
        `;
    });
}

function timesOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

async function hasTrainerConflict(trainerId, startTime, endTime) {
    const { data, error } = await supabaseClient
        .from("courses")
        .select("id, start_time, end_time")
        .eq("trainer_id", trainerId)
        .neq("status", "cancelled");

    if (error) {
        console.log("Trainer conflict check error:", error);
        return true;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    return data.some(course => {
        const existingStart = new Date(course.start_time);
        const existingEnd = new Date(course.end_time);

        return timesOverlap(newStart, newEnd, existingStart, existingEnd);
    });
}

async function hasRoomConflict(roomId, startTime, endTime) {
    const { data, error } = await supabaseClient
        .from("courses")
        .select("id, start_time, end_time")
        .eq("room_id", roomId)
        .neq("status", "cancelled");

    if (error) {
        console.log("Room conflict check error:", error);
        return true;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    return data.some(course => {
        const existingStart = new Date(course.start_time);
        const existingEnd = new Date(course.end_time);

        return timesOverlap(newStart, newEnd, existingStart, existingEnd);
    });
}

async function saveTrainer() {
    const name = document.getElementById("trainerName").value.trim();
    const email = document.getElementById("trainerEmail").value.trim();
    const phoneNumber = document.getElementById("trainerPhone").value.trim();
    const availability = document.getElementById("trainerAvailability").value;

    const workingHours = availability === "Vollzeit" ? 40 : 20;

    if (!name) {
        alert("Bitte Trainername eingeben.");
        return;
    }

    const trainerData = {
        name: name,
        email: email,
        phone_number: phoneNumber,
        availability: availability,
        working_hours: workingHours
    };

    let result;

    if (editingTrainerId) {
        result = await supabaseClient
            .from("trainers")
            .update(trainerData)
            .eq("id", editingTrainerId);
    } else {
        result = await supabaseClient
            .from("trainers")
            .insert(trainerData);
    }

    if (result.error) {
        console.log("Save trainer error:", result.error);
        alert("Trainer konnte nicht gespeichert werden.");
        return;
    }

    alert(editingTrainerId ? "Trainer aktualisiert!" : "Trainer gespeichert!");

    closeModal("trainerModal");
    clearTrainerForm();
    loadTrainers();
}

async function saveCustomer() {
    const name = document.getElementById("customerName").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const phoneNumber = document.getElementById("customerPhone").value.trim();

    if (!name) {
        alert("Bitte Kundenname eingeben.");
        return;
    }

    const { error } = await supabaseClient
        .from("customers")
        .insert({
            name: name,
            email: email,
            phone_number: phoneNumber,
            membership_status: "active"
        });

    if (error) {
        console.log("Save customer error:", error);
        alert("Kunde konnte nicht gespeichert werden.");
        return;
    }

    alert("Kunde gespeichert!");
    closeModal("customerModal");
}

async function saveCourse() {
    const title = document.getElementById("courseTitle").value;
    const trainerSelect = document.getElementById("courseTrainer");
    const trainerId = trainerSelect.value;
    const trainerAvailability = trainerSelect.selectedOptions[0]?.dataset.availability;

    const roomId = document.getElementById("courseRoom").value;
    const courseDate = document.getElementById("courseDate").value;
    const courseStartTime = document.getElementById("courseStartTime").value;
    const courseDuration = Number(document.getElementById("courseDuration").value);

    const maxParticipants = 20;

    if (!title || !trainerId || !roomId || !courseDate || !courseStartTime) {
        alert("Bitte alle Kursdaten ausfüllen.");
        return;
    }

    const startTime = `${courseDate}T${courseStartTime}`;
    const startDate = new Date(startTime);

    if (startDate.getHours() < 8) {
        alert("Der Arbeitstag beginnt laut Bericht erst um 08:00 Uhr.");
        return;
    }

    if (trainerAvailability === "Teilzeit" && startDate.getHours() < 12) {
        alert("Teilzeit-Trainer dürfen nur nachmittags eingeplant werden.");
        return;
    }

    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + courseDuration);

    const endTime =
        `${courseDate}T${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    const trainerConflict = await hasTrainerConflict(trainerId, startTime, endTime);

    if (trainerConflict) {
        alert("Dieser Trainer hat zu dieser Zeit schon einen Kurs.");
        return;
    }

    const roomConflict = await hasRoomConflict(roomId, startTime, endTime);

    if (roomConflict) {
        alert("Dieser Raum ist zu dieser Zeit schon belegt.");
        return;
    }

    let error;

if (editingCourseId) {

    const result = await supabaseClient
        .from("courses")
        .update({
            title: title,
            trainer_id: trainerId,
            room_id: roomId,
            start_time: startTime,
            end_time: endTime
        })
        .eq("id", editingCourseId);

    error = result.error;

} else {

    const result = await supabaseClient
        .from("courses")
        .insert({
            title: title,
            trainer_id: trainerId,
            room_id: roomId,
            start_time: startTime,
            end_time: endTime,
            max_participants: maxParticipants,
            current_participants: 0,
            status: "scheduled"
        });

    error = result.error;
}

    if (error) {
        console.log("Save course error:", error);

        if (error.message && error.message.includes("weekly contract hours")) {
            alert("Der Kurs überschreitet die Wochenstunden dieses Trainers.");
        } else {
            alert("Kurs konnte nicht gespeichert werden.");
        }

        return;
    }

    alert("Kurs gespeichert!");
    closeModal("courseModal");
    loadCourses();
}

document.getElementById("saveTrainerBtn").onclick = saveTrainer;
document.getElementById("saveCustomerBtn").onclick = saveCustomer;
document.getElementById("saveCourseBtn").onclick = saveCourse;

loadTrainers();
loadRooms();
loadCourses();
