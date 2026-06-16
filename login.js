// 1. FIRST: Supabase setup (TOP OF FILE)
const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
    console.log("LOGIN CLICKED");

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    const { data, error } = await supabaseClient
        .from("users")
        .select("*")
        .eq("email", email);

    console.log("DATA:", data);

    if (!data || data.length === 0) {
        alert("User not found");
        return;
    }

    const user = data[0];

    if (user.password_hash !== password) {
        alert("Wrong password");
        return;
    }

    localStorage.setItem("user", JSON.stringify(user));

    if (user.role === "admin") {
        window.location.href = "Admin_Dashboard.html";
    } 
    else if (user.role === "customer") {
        window.location.href = "Kunde-Dashboard.html";
    } 
    else if (user.role === "trainer") {
        window.location.href = "Trainer_Dashboard.html";
    }
}