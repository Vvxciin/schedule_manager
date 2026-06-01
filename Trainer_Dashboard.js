const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co"; // project setting -> Aata Api (without /rest/v1/)
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s"; // project setting -> Api Keys -> publishable key -> default

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase connected!");


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
        `);

    if (error) {
        console.log("Error:", error);
        return;
    }

    console.log(data);

    const scheduleBody = document.getElementById("schedule-body");

    scheduleBody.innerHTML = "";



    data.forEach(course => {

        const start = new Date(course.start_time)
            .toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit"
            });

        const end = new Date(course.end_time)
            .toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit"
            });

        const roomName = course.rooms?.name || "-";

        const branchName =
            course.rooms?.branches?.name || "-";



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