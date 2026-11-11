use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub kind: String,
    pub code: String,
    pub message: String,
    pub hint: Option<String>,
    pub detail: Option<String>,
}

impl AppError {
    pub fn new(kind: &str, code: &str, message: impl Into<String>) -> Self {
        Self {
            kind: kind.to_string(),
            code: code.to_string(),
            message: message.into(),
            hint: None,
            detail: None,
        }
    }

    pub fn user(message: impl Into<String>) -> Self {
        Self::new("user", "E_USER", message)
    }

    pub fn git(message: impl Into<String>, detail: impl Into<String>) -> Self {
        let mut e = Self::new("git", "E_GIT", message);
        e.detail = Some(detail.into());
        e
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("notFound", "E_NOT_FOUND", message)
    }

    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

impl From<git2::Error> for AppError {
    fn from(err: git2::Error) -> Self {
        AppError::new("git", "E_LIBGIT2", err.message().to_string())
            .with_detail(format!("code={:?} class={:?}", err.code(), err.class()))
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::new("io", "E_IO", err.to_string())
    }
}

impl From<notify::Error> for AppError {
    fn from(err: notify::Error) -> Self {
        AppError::new("io", "E_WATCH", err.to_string())
    }
}
