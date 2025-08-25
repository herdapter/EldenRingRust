// Utilisation de l'API globale Tauri (pas d'import de modules en dev sans bundler)

// Version ultra-simple pour debug
console.log("🚀 JavaScript file loaded!");

let selectedFilePath = null;
let tauriApis = null;
let isConnected = false;

// Attendre que le DOM soit prêt
document.addEventListener("DOMContentLoaded", async function() {
    console.log("📄 DOM is ready!");

    // Attendre que Tauri injecte __TAURI__ si besoin
    for (let i = 0; i < 50; i++) { // ~5s max
        if (window.__TAURI__ && window.__TAURI__.core) break;
        await new Promise(r => setTimeout(r, 100));
    }
    tauriApis = window.__TAURI__ || {};
    const core = tauriApis.core;
    const eventApi = tauriApis.event;
    const dialogApi = tauriApis.dialog;

    // Test visuel
    document.body.style.border = "3px solid lime";
    setTimeout(() => {
        document.body.style.border = "none";
        console.log("✅ Visual test completed");
    }, 2000);

    // Trouver les éléments
    const fileInput = document.getElementById("fileInput");
    const browseBtn = document.querySelector(".browse-btn");
    const fileDisplay = document.querySelector(".file-placeholder");
    const connectBtn = document.getElementById("connectBtn");
    const fileStatus = document.getElementById("fileStatus");
    const connectionStatus = document.getElementById("connectionStatus");
    const statusLight = document.getElementById("statusLight");
    const statusText = document.getElementById("statusText");

        console.log("🔍 Elements found:", {
        fileInput: fileInput ? "✅" : "❌",
        browseBtn: browseBtn ? "✅" : "❌",
        fileDisplay: fileDisplay ? "✅" : "❌",
        connectBtn: connectBtn ? "✅" : "❌",
        fileStatus: fileStatus ? "✅" : "❌",
        connectionStatus: connectionStatus ? "✅" : "❌",
        statusLight: statusLight ? "✅" : "❌",
        statusText: statusText ? "✅" : "❌"
    });

    // Si le bouton browse existe
    if (browseBtn) {
        browseBtn.onclick = async function() {
            console.log("🖱️ Browse button clicked!");
            try {
                if (!dialogApi) {
                    console.error("❌ Tauri dialog API non disponible");
                    return;
                }
                // Utilise le plugin dialog si présent, sinon fallback via core.invoke
                let picked;
                if (typeof dialogApi?.open === 'function') {
                    picked = await dialogApi.open({
                        multiple: false,
                        directory: false,
                        filters: [
                            { name: 'Saves', extensions: ['sl2', 'dat', 'save'] },
                            { name: 'All Files', extensions: ['*'] }
                        ]
                    });
                } else if (tauriApis?.core?.invoke) {
                    picked = await tauriApis.core.invoke('plugin:dialog|open', {
                        options: {
                            multiple: false,
                            directory: false,
                            filters: [
                                { name: 'Saves', extensions: ['sl2', 'dat', 'save'] },
                                { name: 'All Files', extensions: ['*'] }
                            ]
                        }
                    });
                } else {
                    console.error('❌ Aucune API de dialogue disponible');
                    return;
                }
                if (typeof picked === 'string' && picked.length > 0) {
                    selectedFilePath = picked;
                    const name = picked.split('/').pop();
                    if (fileDisplay) fileDisplay.textContent = name || picked;
                    if (fileStatus) fileStatus.textContent = name || picked;
                    const fileInputDisplay = document.querySelector(".file-input-display");
                    if (fileInputDisplay) fileInputDisplay.classList.add("has-file");
                    console.log("✅ File chosen:", picked);
                } else {
                    console.log("⚠️ Dialog cancelled or invalid path");
                }
            } catch (e) {
                console.error("❌ Error opening dialog:", e);
            }
        };
    } else {
        console.error("❌ Browse button not found!");
    }

    // Si le file input existe
    // Le <input type="file"> ne fournit pas de chemin lisible côté Rust; on utilise dialog.open ci-dessus

    // Bouton connect
    if (connectBtn) {
        connectBtn.onclick = function() {
            console.log("🔗 Connect button clicked!");

            const codeInput = document.getElementById("textInput");
            const code = codeInput ? codeInput.value.trim() : "";


            if (!selectedFilePath) {
                console.log("⚠️ No file selected");
                alert("Veuillez sélectionner un fichier!");
                return;
            }

            if (!code) {
                console.log("⚠️ No connection code");
                alert("Veuillez entrer votre code de connexion!");
                return;
            }

            console.log("🎯 Ready to connect with file:", selectedFilePath, "and code:", code);

            // Mettre à jour le statut
            if (statusLight) {
                statusLight.classList.add("connected");
            }
            if (statusText) {
                statusText.textContent = "Connecté";
            }
            if (connectionStatus) {
                connectionStatus.textContent = "Connecté";
            }
            if (isConnected) {
                disconnect();
            } else {
                connect();
            }

            console.log("✅ Connection successful!");
        };
    }

    console.log("🎉 Initialization complete!");
});

function updateButtonState() {
  const connectBtn = document.getElementById("connectBtn");
  const btnText = connectBtn.querySelector(".btn-text");
  const btnIcon = connectBtn.querySelector(".btn-icon");

  if (isConnected) {
      btnText.textContent = "Déconnecter";
      btnIcon.textContent = "🔌"; // Icône de déconnexion
      connectBtn.classList.add("disconnect-mode");
  } else {
      btnText.textContent = "Connexion";
      btnIcon.textContent = "🚀"; // Icône de connexion
      connectBtn.classList.remove("disconnect-mode");
  }
}
function connect() {
  // Votre logique de connexion actuelle
  // + appel à invoke('file_watcher', ...)
  if (!tauriApis || !tauriApis.core || !tauriApis.core.invoke) {
    console.error('❌ Tauri core.invoke non disponible');
    return;
  }
  if (!selectedFilePath) {
    console.error('❌ Aucun chemin de fichier sélectionné');
    return;
  }
  tauriApis.core.invoke('start_file_watcher', { path: selectedFilePath })
    .then(() => console.log('📡 Watcher démarré pour', selectedFilePath))
    .catch((e) => console.error('❌ Erreur start_file_watcher:', e));

  // Écoute l'event côté front
  const ev = (tauriApis && tauriApis.event);
  if (ev && typeof ev.listen === 'function') {
    ev.listen('file_updated', (payload) => {
      console.log('🟢 Event file_updated reçu:', payload);
    }).then((unlisten) => {
      // Optionnel: stocker unlisten si besoin pour cleanup
      window.__TAURI__UNLISTEN_FILE_UPDATED = unlisten;
    }).catch((e) => console.error('❌ Erreur event.listen:', e));
  } else {
    console.warn('⚠️ Tauri event.listen non disponible');
  }
  isConnected = true;
  updateButtonState();
  updateStatusIndicators(true);
}

function disconnect() {
  // Logique de déconnexion
  // + éventuellement appel à une fonction Rust pour arrêter le watcher
  if (tauriApis && tauriApis.core && selectedFilePath) {
    tauriApis.core.invoke('stop_file_watcher', { path: selectedFilePath })
      .then(() => console.log('🛑 Watcher arrêté pour', selectedFilePath))
      .catch((e) => console.error('❌ Erreur stop_file_watcher:', e));
  }
  if (window.__TAURI__UNLISTEN_FILE_UPDATED) {
    try { window.__TAURI__UNLISTEN_FILE_UPDATED(); } catch {}
    window.__TAURI__UNLISTEN_FILE_UPDATED = null;
  }
  isConnected = false;
  updateButtonState();
  updateStatusIndicators(false);
}
