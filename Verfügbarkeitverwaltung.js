const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co"; // project setting -> Aata Api (without /rest/v1/)
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s"; // project setting -> Api Keys -> publishable key -> default

const supabaseClient =
    supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document
.querySelector(".absence-form")
.addEventListener("submit", saveAbsence);

async function saveAbsence(e){

    e.preventDefault();

    const reason =
        document.querySelector("select").value;

    const fromDate =
        document.querySelectorAll("input[type='date']")[0].value;

    const toDate =
        document.querySelectorAll("input[type='date']")[1].value;

    const note =
        document.querySelector("textarea").value;

    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        alert("Bitte zuerst einloggen.");
        window.location.href = "login.html";
    }

    if (currentUser.role !== "trainer") {
        alert("Diese Seite ist nur für Trainer.");
        window.location.href = "login.html";
    }

const trainerId = currentUser.id;


    const { error } = await supabaseClient
        .from("absences")
        .insert({
            trainer_id: trainerId,
            reason: note || reason,
            start_date: fromDate,
            end_date: toDate,
            status: reason
        });

    if(error){
        console.log("Supabase Error:", error);
        alert(error.message);
        return;
    }

    alert("Gespeichert");
    loadAbsences();
}




async function loadAbsences() {

    const trainerId =
        "12762f03-2fbe-4715-a21f-5e6db7c80c19";

    const { data, error } = await supabaseClient
        .from("absences")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("start_date", { ascending: false });

    if(error){
        console.log(error);
        return;
    }

    const container =
        document.getElementById("absence-list");

    container.innerHTML = "";

    data.forEach(absence => {

        container.innerHTML += `
            <div style="
                border:1px solid #ccc;
                padding:10px;
                margin-bottom:10px;
                border-radius:8px;
            ">
                <b>${absence.status}</b><br>
                ${absence.start_date}
                bis
                ${absence.end_date}<br>
                ${absence.reason || ""}
            </div>
        `;
    });
}

loadAbsences();


document
.getElementById("availability-form")
.addEventListener("submit", saveAvailability);


async function saveAvailability(e){

    e.preventDefault();

    const trainerId =
    "12762f03-2fbe-4715-a21f-5e6db7c80c19";

    const day =
    document.getElementById("availability-day").value;

    const start =
    document.getElementById("availability-start").value;

    const end =
    document.getElementById("availability-end").value;

    const { error } = await supabaseClient
        .from("trainer_availability")
        .insert({
            trainer_id: trainerId,
            day_of_week: day,
            start_time: start,
            end_time: end
        });

    if(error){
        console.log(error);
        alert(error.message);
        return;
    }

    alert("Verfügbarkeit gespeichert");

    loadAvailability();
}

async function loadAvailability(){

    const trainerId =
    "12762f03-2fbe-4715-a21f-5e6db7c80c19";

    const { data, error } = await supabaseClient
        .from("trainer_availability")
        .select("*")
        .eq("trainer_id", trainerId);

    if(error){
        console.log(error);
        return;
    }

    const container =
    document.getElementById("availability-list");

    container.innerHTML = "";

    data.forEach(item => {

        container.innerHTML += `
            <div style="
                border:1px solid #ccc;
                padding:8px;
                margin:5px;
            ">
                Tag ${item.day_of_week}
                :
                ${item.start_time}
                -
                ${item.end_time}
            </div>
        `;
    });
}

loadAvailability();

