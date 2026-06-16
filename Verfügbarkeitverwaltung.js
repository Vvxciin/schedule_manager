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

    /*const trainerId =
        "PUT_TRAINER_ID_HERE";*/
    const trainerId =
        "12762f03-2fbe-4715-a21f-5e6db7c80c19";


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
}