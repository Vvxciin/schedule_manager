const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase connected!");

async function loadTrainers() {
    const { data, error } = await supabaseClient
        .from("trainers")
        .select("name, working_hours, availability");

    if (error) {
        console.log("Trainer Error:", error);
        return;
    }

    const trainerBody = document.getElementById("trainer-body");
    trainerBody.innerHTML = "";

    data.forEach(trainer => {
        trainerBody.innerHTML += `
            <tr>
                <td>${trainer.name}</td>
                <td>${trainer.availability || "-"}</td>
                <td>${trainer.working_hours || "-"}/40</td>
                <td>${trainer.availability || "-"}</td>
                <td>Bearbeiten</td>
            </tr>
        `;
    });
}

async function loadCourses() {
    const { data, error } = await supabaseClient
        .from("courses")
        .select(`
            title,
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
        `);

    if (error) {
        console.log("Course Error:", error);
        return;
    }

    const courseBody = document.getElementById("course-body");
    courseBody.innerHTML = "";

    data.forEach(course => {
        const start = new Date(course.start_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        const end = new Date(course.end_time).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit"
        });

        courseBody.innerHTML += `
            <tr>
                <td>${start} - ${end}</td>
                <td>${course.title}</td>
                <td>${course.trainers?.name || "-"}</td>
                <td>${course.rooms?.name || "-"}</td>
                <td>${course.rooms?.branches?.name || "-"}</td>
                <td>${course.current_participants}/${course.max_participants}</td>
                <td>${course.status}</td>
            </tr>
        `;
    });
}

loadTrainers();
loadCourses();