const SUPABASE_URL = "https://qixffrvvktpajwiclhbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_5MNAMD_t3GdttXnONyy0-A_qqW0GA9s";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Bitte Email und Passwort eingeben.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

    if (error) {
        console.log("Login error:", error);
        alert("Login fehlgeschlagen.");
        return;
    }

    if (!data) {
        alert("User nicht gefunden.");
        return;
    }

    const user = data;

    if (user.password_hash !== password) {
        alert("Falsches Passwort.");
        return;
    }

    localStorage.setItem("currentUser", JSON.stringify(user));

    if (user.role === "admin") {
        window.location.href = "Admin_Dashboard.html";
    } else if (user.role === "customer") {
        window.location.href = "Kunde-Dashboard.html";
    } else if (user.role === "trainer") {
        window.location.href = "Trainer_Dashboard.html";
    } else {
        alert("Unbekannte Rolle: " + user.role);
    }
}