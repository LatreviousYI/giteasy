use crate::error::AppError;
use serde::Serialize;
use tauri::AppHandle;

const RELEASES_URL: &str = "https://github.com/LatreviousYI/giteasy/releases/latest";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContextDto {
    pub current_version: String,
    pub install_kind: String,
    pub can_install_in_place: bool,
    pub executable: String,
}

pub(crate) fn classify_install_kind(
    executable: &str,
    appimage: bool,
    macos: bool,
) -> &'static str {
    if appimage {
        "appimage"
    } else if macos {
        "macos"
    } else if executable == "/usr/bin/giteasy"
        || executable.starts_with("/usr/local/bin/")
    {
        "deb"
    } else {
        "portable"
    }
}

#[tauri::command]
pub fn update_context(app: AppHandle) -> UpdateContextDto {
    let executable = std::env::current_exe()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let install_kind = classify_install_kind(
        &executable,
        std::env::var_os("APPIMAGE").is_some(),
        cfg!(target_os = "macos"),
    );
    UpdateContextDto {
        current_version: app.package_info().version.to_string(),
        install_kind: install_kind.to_string(),
        can_install_in_place: matches!(install_kind, "appimage" | "macos"),
        executable,
    }
}

#[tauri::command]
pub fn open_update_page() -> Result<(), AppError> {
    crate::tools::open_path_default(RELEASES_URL)
        .map(|_| ())
        .map_err(|error| {
            AppError::new("io", "E_OPEN_UPDATE_PAGE", "无法打开下载页面")
                .with_detail(error.to_string())
        })
}
