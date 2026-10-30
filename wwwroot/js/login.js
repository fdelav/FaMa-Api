document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        if (!email || !password) {
            throw new Error("Por favor, completa todos los campos.");
        }
        const response = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        }); 
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem("token", data.accessToken);
            window.location.href = "/index.html";
        } else {
            document.getElementById("login-error").textContent = "Correo o contraseña incorrectos.";
        }
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        document.getElementById("login-error").textContent = error.message || "No se pudo conectar con el servidor.";
    }
        
})