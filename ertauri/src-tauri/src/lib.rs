mod file_watch {
    use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
    use tauri::{AppHandle, Emitter, State};
    use std::path::{Path, PathBuf};
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    pub struct WatcherManager {
        pub(crate) watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
    }

    impl WatcherManager {
        pub fn new() -> Self {
            Self {
                watchers: Arc::new(Mutex::new(HashMap::new())),
            }
        }
    }

    #[tauri::command]
    pub fn start_file_watcher(
        app_handle: AppHandle,
        path: String,
        watcher_manager: State<WatcherManager>,
    ) -> Result<(), String> {
        let path_buf = PathBuf::from(&path);

        if !path_buf.exists() {
            return Err(format!("Le fichier n'existe pas: {}", path));
        }

        let path_key = path.clone();
        let path_for_event = path.clone();

        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        let _ = app_handle.emit("file_updated", &path_for_event);
                        println!("Fichier modifié: {}", path_for_event);
                    }
                }
            },
            notify::Config::default(),
        ).map_err(|e| format!("Erreur lors de la création du watcher: {}", e))?;

        let mut watcher_instance = watcher;
        watcher_instance
            .watch(&path_buf, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Erreur lors du watch: {}", e))?;

        let mut watchers = watcher_manager.watchers.lock().unwrap();

        if let Some(_old_watcher) = watchers.remove(&path_key) {
            println!("Arrêt de l'ancien watcher pour: {}", path_key);
        }

        watchers.insert(path_key.clone(), watcher_instance);

        println!("Watcher démarré pour: {}", path_key);
        Ok(())
    }

    #[tauri::command]
    pub fn stop_file_watcher(
        path: String,
        watcher_manager: State<WatcherManager>,
    ) -> Result<(), String> {
        let mut watchers = watcher_manager.watchers.lock().unwrap();

        if let Some(mut watcher) = watchers.remove(&path) {
            watcher.unwatch(&Path::new(&path))
                .map_err(|e| format!("Erreur lors de l'unwatch: {}", e))?;

            println!("Watcher arrêté pour: {}", path);
            Ok(())
        } else {
            Err(format!("Aucun watcher trouvé pour le path: {}", path))
        }
    }

    #[tauri::command]
    pub fn stop_all_watchers(watcher_manager: State<WatcherManager>) -> Result<(), String> {
        let mut watchers = watcher_manager.watchers.lock().unwrap();

        for (path, mut watcher) in watchers.drain() {
            let _ = watcher.unwatch(&Path::new(&path));
            println!("Watcher arrêté pour: {}", path);
        }

        Ok(())
    }

    #[tauri::command]
    pub fn list_watched_files(watcher_manager: State<WatcherManager>) -> Vec<String> {
        let watchers = watcher_manager.watchers.lock().unwrap();
        watchers.keys().cloned().collect()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(file_watch::WatcherManager::new())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            file_watch::start_file_watcher,
            file_watch::stop_file_watcher,
            file_watch::stop_all_watchers,
            file_watch::list_watched_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
