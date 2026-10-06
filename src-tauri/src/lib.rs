// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn list_images(file: String) -> Result<Vec<String>, String> {
    let dir = std::path::Path::new(&file)
        .parent()
        .ok_or("no parent dir")?;
    Ok(std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|x| x.to_str()).is_some_and(|x| {
                matches!(
                    x.to_lowercase().as_str(),
                    "png" | "jpg" | "jpeg" | "jfif" | "webp" | "gif"
                )
            })
        })
        .filter_map(|p| p.to_str().map(String::from))
        .collect())
}

#[tauri::command]
fn file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(path).map(|m| m.len()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_images, file_size])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
