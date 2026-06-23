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


async function createNotification(message, type = "info", userId = null) {
    const notificationData = {
        message: message,
        type: type,
        is_read: false
    };

    if (userId) {
        notificationData.user_id = userId;
    }

    const { error } = await supabaseClient
        .from("notifications")
        .insert(notificationData);

    if (error) {
        console.log("Create notification error:", error);
    }
}

async function loadNotifications() {
    const { data, error } = await supabaseClient
        .from("notifications")
        .select("message, type, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.log("Notification Error:", error);
        return;
    }

    const notificationBody = document.getElementById("notification-body");

    if (!notificationBody) {
        console.log("notification-body not found");
        return;
    }

    notificationBody.innerHTML = "";

    if (!data || data.length === 0) {
        notificationBody.innerHTML = `
            <div class="notification-item">
                Noch keine Benachrichtigungen.
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

        notificationBody.innerHTML += `
            <div class="notification-item">
                <div>
                    <span class="notification-type">${notification.type || "Info"}:</span>
                    ${notification.message}
                </div>
                <div class="notification-date">${date}</div>
            </div>
        `;
    });
}


let editingTrainerId = null;
let editingCourseId = null;
let editingBranchId = null;
let editingRoomId = null;
let allTrainersCache = [];

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}



function clearBranchForm() {
    editingBranchId = null;

    document.getElementById("branchName").value = "";
    document.getElementById("branchLocation").value = "";
}

function clearRoomForm() {
    editingRoomId = null;

    document.getElementById("roomName").value = "";
    document.getElementById("roomCapacity").value = 20;
    document.getElementById("roomLocation").value = "";

    const roomBranch = document.getElementById("roomBranch");

    if (roomBranch.options.length > 0) {
        roomBranch.selectedIndex = 0;
    }
}

function openBranchEditModal(branch) {
    editingBranchId = branch.id;

    document.getElementById("branchName").value = branch.name || "";
    document.getElementById("branchLocation").value = branch.location || "";

    openModal("roomModal");
}

function openRoomEditModal(room) {
    editingRoomId = room.id;

    document.getElementById("roomName").value = room.name || "";
    document.getElementById("roomCapacity").value = room.capacity || 20;
    document.getElementById("roomLocation").value = room.location || "";
    document.getElementById("roomBranch").value = room.branch_id || "";

    openModal("roomModal");
}



function openCourseEditModal(course) {

    editingCourseId = course.id;
    document.getElementById("courseModalTitle").innerText = "Kurs bearbeiten";

    document.getElementById("courseTitle").value =
        course.title;

    document.getElementById("courseTrainer").value =
        course.trainer_id;

    document.getElementById("courseRoom").value =
        course.room_id;





    document.getElementById("courseDate").value =
    course.start_time.slice(0, 10);

    document.getElementById("courseStartTime").value =
    course.start_time.slice(11, 16);





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
    document.getElementById("trainerPassword").value = "";
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
document.getElementById("openCustomerModal").onclick = () => {
    openModal("customerModal");
    loadCustomers();
};
document.getElementById("openCourseModal").onclick = () => {

    editingCourseId = null;

    document.getElementById("courseModalTitle").innerText =
        "Kurs erstellen";

    openModal("courseModal");
};

document.getElementById("openRoomModal").onclick = () => {
    openModal("roomModal");
    loadBranches();
    loadRooms();
};

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

    allTrainersCache = data || [];

    fillCourseTrainerDropdown(allTrainersCache);
    renderTrainerTable();
}

function fillCourseTrainerDropdown(trainers) {
    const courseTrainer = document.getElementById("courseTrainer");

    if (!courseTrainer) {
        return;
    }

    courseTrainer.innerHTML = "";

    trainers.forEach(trainer => {
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

function renderTrainerTable() {
    const trainerBody = document.getElementById("trainer-body");
    const searchInput = document.getElementById("trainerSearchInput");

    if (!trainerBody) {
        return;
    }

    const searchTerm = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const filteredTrainers = allTrainersCache.filter(trainer => {
        const name = String(trainer.name || "").toLowerCase();
        const email = String(trainer.email || "").toLowerCase();
        const phone = String(trainer.phone_number || "").toLowerCase();
        const availability = String(trainer.availability || "").toLowerCase();

        return (
            name.includes(searchTerm) ||
            email.includes(searchTerm) ||
            phone.includes(searchTerm) ||
            availability.includes(searchTerm)
        );
    });

    trainerBody.innerHTML = "";

    if (filteredTrainers.length === 0) {
        trainerBody.innerHTML = `
            <tr>
                <td colspan="5">Keine Trainer gefunden.</td>
            </tr>
        `;
        return;
    }

    filteredTrainers.forEach(trainer => {
        const safeTrainer = JSON.stringify(trainer).replaceAll("'", "&apos;");

        trainerBody.innerHTML += `
            <tr>
                <td>${trainer.name || "-"}</td>
                <td>${trainer.availability || "-"}</td>
                <td>${trainer.working_hours || "-"} h</td>
                <td>aktiv</td>
                <td>
                    <button class="edit-btn" onclick='openTrainerEditModal(${safeTrainer})'>
                        Bearbeiten
                    </button>
                    <button class="delete-btn" onclick="deleteTrainer('${trainer.id}', '${trainer.name}')">
                        Löschen
                    </button>
                </td>
            </tr>
        `;
    });
}

async function loadBranches() {
    const { data, error } = await supabaseClient
        .from("branches")
        .select("id, name, location")
        .order("name", { ascending: true });

    if (error) {
        console.log("Branch Error:", error);
        return;
    }

    const branchBody = document.getElementById("branch-body");
    const roomBranch = document.getElementById("roomBranch");

    if (branchBody) {
        branchBody.innerHTML = "";
    }

    if (roomBranch) {
        roomBranch.innerHTML = "";
    }

    data.forEach(branch => {
        const safeBranch = JSON.stringify(branch).replaceAll("'", "&apos;");

        if (branchBody) {
            branchBody.innerHTML += `
                <tr>
                    <td>${branch.name || "-"}</td>
                    <td>${branch.location || "-"}</td>
                    <td>
                        <button class="edit-btn" onclick='openBranchEditModal(${safeBranch})'>
                            Bearbeiten
                        </button>
                        <button class="delete-btn" onclick="deleteBranch('${branch.id}', '${branch.name}')">
                            Löschen
                        </button>
                    </td>
                </tr>
            `;
        }

        if (roomBranch) {
            roomBranch.innerHTML += `
                <option value="${branch.id}">
                    ${branch.name}
                </option>
            `;
        }
    });
}

async function loadRooms() {
    const { data, error } = await supabaseClient
        .from("rooms")
        .select(`
            id,
            name,
            capacity,
            location,
            branch_id,
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
    const roomBody = document.getElementById("room-body");

    if (courseRoom) {
        courseRoom.innerHTML = "";
    }

    if (roomBody) {
        roomBody.innerHTML = "";
    }

    data.forEach(room => {
        const branchName = room.branches?.name || "Keine Filiale";
        const safeRoom = JSON.stringify(room).replaceAll("'", "&apos;");

        if (courseRoom) {
            courseRoom.innerHTML += `
                <option value="${room.id}">
                    ${room.name} - ${branchName}
                </option>
            `;
        }

        if (roomBody) {
            roomBody.innerHTML += `
                <tr>
                    <td>${room.name || "-"}</td>
                    <td>${room.capacity || "-"}</td>
                    <td>${branchName}</td>
                    <td>
                        <button class="edit-btn" onclick='openRoomEditModal(${safeRoom})'>
                            Bearbeiten
                        </button>
                        <button class="delete-btn" onclick="deleteRoom('${room.id}', '${room.name}')">
                            Löschen
                        </button>
                    </td>
                </tr>
            `;
        }
    });
}

async function loadCourses() {
    const today = getLocalDateString(new Date());
    const tomorrow = getLocalDateString(addDays(new Date(), 1));

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
        .gte("start_time", today + "T00:00:00")
        .lt("start_time", tomorrow + "T00:00:00")
        .order("start_time", { ascending: true });

    if (error) {
        console.log("Course Error:", error);
        return;
    }

    
    const courseBody = document.getElementById("course-body");
    courseBody.innerHTML = "";
    
    if (!data || data.length === 0) {
        courseBody.innerHTML = `
            <tr>
                <td colspan="8">Heute gibt es keine Kurse.</td>
            </tr>
        `;
        return;
    }

    data.forEach(course => {
        const start = course.start_time.slice(11, 16);
        const end = course.end_time.slice(11, 16);

        
        const cancelledClass =
            course.status === "cancelled" || course.status === "canceled"
             ? "canceled-row"
             : "";

        courseBody.innerHTML += `
            <tr class="${cancelledClass}">
                <td>${start} - ${end}</td>
                <td>${course.title}</td>
                <td>${course.trainers?.name || "-"}</td>
                <td>${course.rooms?.name || "-"}</td>
                <td>${course.rooms?.branches?.name || "-"}</td>
                <td>${course.current_participants}/${course.max_participants}</td>
                <td>${course.status}</td>
                <td>
                    <button class="edit-btn" onclick='openCourseEditModal(${JSON.stringify(course)})'>
                    Bearbeiten
                    </button>
                    <button class="delete-btn" onclick="deleteCourse('${course.id}', '${course.title}')">
                    Absagen
                    </button>
                </td>
            </tr>
        `;
    });
}

function timesOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

async function hasTrainerConflict(trainerId, startTime, endTime, ignoredCourseId = null) {
    const { data, error } = await supabaseClient
        .from("courses")
        .select("id, start_time, end_time")
        .eq("trainer_id", trainerId)
        .neq("status", "canceled");

    if (error) {
        console.log("Trainer conflict check error:", error);
        return true;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    return data.some(course => {
        if (ignoredCourseId && course.id === ignoredCourseId) {
            return false;
        }

        const existingStart = new Date(course.start_time);
        const existingEnd = new Date(course.end_time);

        return timesOverlap(newStart, newEnd, existingStart, existingEnd);
    });
}

async function hasRoomConflict(roomId, startTime, endTime, ignoredCourseId = null) {
    const { data, error } = await supabaseClient
        .from("courses")
        .select("id, start_time, end_time")
        .eq("room_id", roomId)
        .neq("status", "canceled");

    if (error) {
        console.log("Room conflict check error:", error);
        return true;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    return data.some(course => {
        if (ignoredCourseId && course.id === ignoredCourseId) {
            return false;
        }

        const existingStart = new Date(course.start_time);
        const existingEnd = new Date(course.end_time);

        return timesOverlap(newStart, newEnd, existingStart, existingEnd);
    });
}


async function deleteTrainer(trainerId, trainerName) {
    const confirmed = confirm(`Trainer ${trainerName} wirklich löschen?`);

    if (!confirmed) {
        return;
    }

    const { data: assignedCourses, error: courseCheckError } = await supabaseClient
        .from("courses")
        .select("id")
        .eq("trainer_id", trainerId)
        .neq("status", "canceled");

    if (courseCheckError) {
        console.log("Trainer delete check error:", courseCheckError);
        alert("Trainer konnte nicht geprüft werden.");
        return;
    }

    if (assignedCourses.length > 0) {
        alert("Dieser Trainer ist noch Kursen zugewiesen. Bitte zuerst diese Kurse löschen oder bearbeiten.");
        return;
    }

    const { error } = await supabaseClient
        .from("trainers")
        .delete()
        .eq("id", trainerId);

    if (error) {
        console.log("Delete trainer error:", error);
        alert("Trainer konnte nicht gelöscht werden.");
        return;
    }

    await createNotification(`Trainer ${trainerName} wurde gelöscht.`, "Trainer");
    alert("Trainer gelöscht!");
    loadTrainers();
    loadNotifications();
    }

async function deleteCourse(courseId, courseTitle) {
    const confirmed = confirm(`Kurs ${courseTitle} wirklich absagen?`);

    if (!confirmed) {
        return;
    }

    const { error } = await supabaseClient
        .from("courses")
        .update({
            status: "canceled"
        })
        .eq("id", courseId);

    if (error) {
        console.log("Cancel course error:", error);
        alert("Kurs konnte nicht abgesagt werden: " + error.message);
        return;
    }

    await createNotification(`Kurs ${courseTitle} wurde abgesagt.`, "Kurs");
    alert("Kurs abgesagt!");
    loadCourses();
    loadNotifications();
    }

async function deleteCustomer(customerId, customerName) {
    const confirmed = confirm(`Kunde ${customerName} wirklich löschen? Alle Buchungen von diesem Kunden werden auch gelöscht.`);

    if (!confirmed) {
        return;
    }

    const { error: bookingDeleteError } = await supabaseClient
        .from("bookings")
        .delete()
        .eq("customer_id", customerId);

    if (bookingDeleteError) {
        console.log("Delete customer bookings error:", bookingDeleteError);
        alert("Buchungen von diesem Kunden konnten nicht gelöscht werden.");
        return;
    }

    const { error } = await supabaseClient
        .from("customers")
        .delete()
        .eq("id", customerId);

    if (error) {
        console.log("Delete customer error:", error);
        alert("Kunde konnte nicht gelöscht werden.");
        return;
    }

    await createNotification(`Kunde ${customerName} wurde gelöscht.`, "Kunde");
    alert("Kunde gelöscht!");
    loadCustomers();
    loadNotifications();
}



async function saveBranch() {
    const name = document.getElementById("branchName").value.trim();
    const location = document.getElementById("branchLocation").value.trim();

    if (!name) {
        alert("Bitte Filialname eingeben.");
        return;
    }

    const branchData = {
        name: name,
        location: location
    };

    let result;

    if (editingBranchId) {
        result = await supabaseClient
            .from("branches")
            .update(branchData)
            .eq("id", editingBranchId);
    } else {
        result = await supabaseClient
            .from("branches")
            .insert(branchData);
    }

    if (result.error) {
        console.log("Save branch error:", result.error);
        alert("Filiale konnte nicht gespeichert werden.");
        return;
    }

    await createNotification(
        editingBranchId
            ? `Filiale ${name} wurde aktualisiert.`
            : `Filiale ${name} wurde hinzugefügt.`,
        "Filiale"
    );

    alert(editingBranchId ? "Filiale aktualisiert!" : "Filiale gespeichert!");

    clearBranchForm();
    loadBranches();
    loadRooms();
    loadNotifications();
}

async function saveRoom() {
    const name = document.getElementById("roomName").value.trim();
    const capacity = Number(document.getElementById("roomCapacity").value);
    const location = document.getElementById("roomLocation").value.trim();
    const branchId = document.getElementById("roomBranch").value;

    if (!name || !branchId) {
        alert("Bitte Raumname und Filiale eingeben.");
        return;
    }

    if (capacity < 1 || capacity > 20) {
        alert("Die Raumkapazität muss zwischen 1 und 20 liegen.");
        return;
    }

    const roomData = {
        name: name,
        capacity: capacity,
        location: location,
        branch_id: branchId
    };

    let result;

    if (editingRoomId) {
        result = await supabaseClient
            .from("rooms")
            .update(roomData)
            .eq("id", editingRoomId);
    } else {
        result = await supabaseClient
            .from("rooms")
            .insert(roomData);
    }

    if (result.error) {
        console.log("Save room error:", result.error);
        alert("Raum konnte nicht gespeichert werden.");
        return;
    }

    await createNotification(
        editingRoomId
            ? `Raum ${name} wurde aktualisiert.`
            : `Raum ${name} wurde hinzugefügt.`,
        "Raum"
    );

    alert(editingRoomId ? "Raum aktualisiert!" : "Raum gespeichert!");

    clearRoomForm();
    loadRooms();
    loadNotifications();
}

async function deleteBranch(branchId, branchName) {
    const confirmed = confirm(`Filiale ${branchName} wirklich löschen?`);

    if (!confirmed) {
        return;
    }

    const { data: roomsInBranch, error: roomCheckError } = await supabaseClient
        .from("rooms")
        .select("id")
        .eq("branch_id", branchId);

    if (roomCheckError) {
        console.log("Branch delete check error:", roomCheckError);
        alert("Filiale konnte nicht geprüft werden.");
        return;
    }

    if (roomsInBranch.length > 0) {
        alert("Diese Filiale hat noch Räume. Bitte zuerst die Räume löschen oder verschieben.");
        return;
    }

    const { error } = await supabaseClient
        .from("branches")
        .delete()
        .eq("id", branchId);

    if (error) {
        console.log("Delete branch error:", error);
        alert("Filiale konnte nicht gelöscht werden.");
        return;
    }

    await createNotification(`Filiale ${branchName} wurde gelöscht.`, "Filiale");

    alert("Filiale gelöscht!");
    loadBranches();
    loadRooms();
    loadNotifications();
}

async function deleteRoom(roomId, roomName) {
    const confirmed = confirm(`Raum ${roomName} wirklich löschen?`);

    if (!confirmed) {
        return;
    }

    const { data: coursesInRoom, error: courseCheckError } = await supabaseClient
        .from("courses")
        .select("id")
        .eq("room_id", roomId)
        .neq("status", "canceled");

    if (courseCheckError) {
        console.log("Room delete check error:", courseCheckError);
        alert("Raum konnte nicht geprüft werden.");
        return;
    }

    if (coursesInRoom.length > 0) {
        alert("Dieser Raum ist noch Kursen zugewiesen. Bitte zuerst diese Kurse löschen oder bearbeiten.");
        return;
    }

    const { error } = await supabaseClient
        .from("rooms")
        .delete()
        .eq("id", roomId);

    if (error) {
        console.log("Delete room error:", error);
        alert("Raum konnte nicht gelöscht werden.");
        return;
    }

    await createNotification(`Raum ${roomName} wurde gelöscht.`, "Raum");

    alert("Raum gelöscht!");
    loadRooms();
    loadNotifications();
}


async function saveTrainer() {
    const name = document.getElementById("trainerName").value.trim();
    const email = document.getElementById("trainerEmail").value.trim().toLowerCase();
    const phoneNumber = document.getElementById("trainerPhone").value.trim();
    const password = document.getElementById("trainerPassword").value.trim();
    const availability = document.getElementById("trainerAvailability").value;

    const workingHours = availability === "Vollzeit" ? 40 : 20;

    if (!name || !email) {
        alert("Bitte Name und Email eingeben.");
        return;
    }

    if (!editingTrainerId && !password) {
    alert("Bitte Passwort für neuen Trainer eingeben.");
    return;
}

if (!editingTrainerId) {
    const { data: existingUser, error: existingUserError } = await supabaseClient
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (existingUserError) {
        console.log("Existing user check error:", existingUserError);
        alert("Email konnte nicht geprüft werden.");
        return;
    }

    if (existingUser) {
        alert("Diese Email existiert bereits. Bitte andere Email verwenden.");
        return;
    }
}

const trainerData = {
        name,
        email,
        phone_number: phoneNumber,
        availability,
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

    if (password) {
        const { error: userError } = await supabaseClient
            .from("users")
            .update({
                password_hash: password,
                role: "trainer",
                name: name
            })
            .eq("email", email);

        if (userError) {
            console.log("User password update error:", userError);
            alert("Trainer gespeichert, aber Passwort konnte nicht gesetzt werden.");
            return;
        }
    }

    await createNotification(
        editingTrainerId
            ? `Trainer ${name} wurde aktualisiert.`
            : `Trainer ${name} wurde hinzugefügt.`,
        "Trainer"
    );

    alert(editingTrainerId ? "Trainer aktualisiert!" : "Trainer gespeichert!");

    closeModal("trainerModal");
    clearTrainerForm();
    loadTrainers();
    loadNotifications();
}

async function loadCustomers() {
    const { data, error } = await supabaseClient
        .from("customers")
        .select("id, name, email")
        .order("name", { ascending: true });

    if (error) {
        console.log("Load customers error:", error);
        return;
    }

    const customerBody = document.getElementById("customer-body");
    customerBody.innerHTML = "";

    data.forEach(customer => {
        customerBody.innerHTML += `
            <tr>
                <td>${customer.name || "-"}</td>
                <td>${customer.email || "-"}</td>
                <td>
                    <button class="delete-btn" onclick="deleteCustomer('${customer.id}', '${customer.name}')">
                        Löschen
                    </button>
                </td>
            </tr>
        `;
    });
}

async function saveCustomer() {
    const name = document.getElementById("customerName").value.trim();
    const email = document.getElementById("customerEmail").value.trim().toLowerCase();
    const phoneNumber = document.getElementById("customerPhone").value.trim();
    const password = document.getElementById("customerPassword").value.trim();

    if (!name || !email || !password) {
    alert("Bitte Name, Email und Passwort eingeben.");
    return;
}

const { data: existingUser, error: existingUserError } = await supabaseClient
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

if (existingUserError) {
    console.log("Existing user check error:", existingUserError);
    alert("Email konnte nicht geprüft werden.");
    return;
}

if (existingUser) {
    alert("Diese Email existiert bereits. Bitte andere Email verwenden.");
    return;
}

const { error } = await supabaseClient
        .from("customers")
        .insert({
            name,
            email,
            phone_number: phoneNumber,
            membership_status: "active"
        });

    if (error) {
        console.log("Save customer error:", error);
        alert("Kunde konnte nicht gespeichert werden.");
        return;
    }

    const { error: userError } = await supabaseClient
        .from("users")
        .update({
            password_hash: password,
            role: "customer",
            name: name
        })
        .eq("email", email);

    if (userError) {
        console.log("User password update error:", userError);
        alert("Kunde gespeichert, aber Passwort konnte nicht gesetzt werden.");
        return;
    }

    await createNotification(`Kunde ${name} wurde hinzugefügt.`, "Kunde");

    alert("Kunde gespeichert!");

    document.getElementById("customerName").value = "";
    document.getElementById("customerEmail").value = "";
    document.getElementById("customerPhone").value = "";
    document.getElementById("customerPassword").value = "";

    loadCustomers();
    loadNotifications();
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

    const trainerConflict = await hasTrainerConflict(
    trainerId,
    startTime,
    endTime,
    editingCourseId
);

    if (trainerConflict) {
        alert("Dieser Trainer hat zu dieser Zeit schon einen Kurs.");
        return;
    }

    const roomConflict = await hasRoomConflict(
        roomId,
        startTime,
        endTime,
        editingCourseId
    );


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

    await createNotification(
    editingCourseId
        ? `Kurs ${title} wurde aktualisiert.`
        : `Kurs ${title} wurde erstellt.`,
    "Kurs"
);

    alert("Kurs gespeichert!");
    closeModal("courseModal");
    editingCourseId = null;
    loadCourses();
    loadNotifications();
}

document.getElementById("saveTrainerBtn").onclick = saveTrainer;
document.getElementById("saveCustomerBtn").onclick = saveCustomer;
document.getElementById("saveCourseBtn").onclick = saveCourse;

document.getElementById("saveBranchBtn").onclick = saveBranch;
document.getElementById("saveRoomBtn").onclick = saveRoom;

document.getElementById("clearBranchBtn").onclick = clearBranchForm;
document.getElementById("clearRoomBtn").onclick = clearRoomForm;

document.getElementById("refreshNotificationsBtn").onclick = loadNotifications;



// for info part
async function getExactCount(tableName, filterCallback = null) {
    let query = supabaseClient
        .from(tableName)
        .select("*", {
            count: "exact",
            head: true
        });

    if (filterCallback) {
        query = filterCallback(query);
    }

    const { count, error } = await query;

    if (error) {
        console.log(`Count error for ${tableName}:`, error);
        return 0;
    }

    return count || 0;
}

async function loadDashboardNumbers() {
    const today = getLocalDateString(new Date());

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const trainerCount = await getExactCount("trainers");

    const sickCount = await getExactCount("absences", query =>
        query
            .lte("start_date", today)
            .gte("end_date", today)
    );

    const customerCount = await getExactCount("customers");

    const newCustomerCount = await getExactCount("customers", query =>
        query.gte("created_at", weekAgo.toISOString())
    );

    const todayCourseCount = await getExactCount("courses", query =>
        query
            .gte("start_time", today + "T00:00:00")
            .lt("start_time", getLocalDateString(addDays(new Date(), 1)) + "T00:00:00")
    );

    const { data: todayCourses, error: todayCoursesError } = await supabaseClient
        .from("courses")
        .select(`
            id,
            rooms (
                branches (
                    id
                )
            )
        `)
        .gte("start_time", today + "T00:00:00")
        .lt("start_time", getLocalDateString(addDays(new Date(), 1)) + "T00:00:00");

    if (todayCoursesError) {
        console.log("Today branches count error:", todayCoursesError);
    }

    document.getElementById("active-trainers-count").innerText =
        trainerCount;

    document.getElementById("sick-trainers-count").innerText =
        `${sickCount} krank gemeldet`;

    document.getElementById("customers-count").innerText =
        customerCount;

    document.getElementById("today-courses-count").innerText =
        todayCourseCount;

    document.getElementById("new-customers-week").innerText =
        `+${newCustomerCount} diese Woche`;

    const branchIds = new Set();

    if (todayCourses) {
        todayCourses.forEach(course => {
            const branchId = course.rooms?.branches?.id;

            if (branchId) {
                branchIds.add(branchId);
            }
        });
    }

    document.getElementById("today-branches-count").innerText =
        branchIds.size;
}

const trainerSearchInput = document.getElementById("trainerSearchInput");

if (trainerSearchInput) {
    trainerSearchInput.addEventListener("input", () => {
        renderTrainerTable();
    });
}

loadTrainers();
loadBranches();
loadRooms();
loadCourses();
loadNotifications();

loadDashboardNumbers();