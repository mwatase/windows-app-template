//! Typed errors for every command, chassis and program alike.
//!
//! The governing constraint: when a program fails on a customer's machine,
//! nobody is standing next to it. So an error carries three things, each for
//! a different reader:
//!
//! - a stable **code** the interface can branch on (`not_found`),
//! - a **message** that is safe to show a customer ("That file could not be
//!   found."), never a path, a stack trace or an OS error string,
//! - the technical **detail**, which goes to the log file and nowhere else.
//!
//! Commands return `Result<T, CommandError>` and use `?` on anything that
//! converts into [`AppError`]. The conversion is where the detail is logged,
//! so no failure can reach the interface without also reaching the log.

use serde::Serialize;

/// What the interface receives when a command fails.
///
/// This is the wire format. It is deliberately small: the interface needs to
/// know *which* failure happened and *what to tell the user*, and nothing else
/// should cross the boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
pub struct CommandError {
    /// Stable identifier. Chassis codes are bare (`not_found`); program codes
    /// are namespaced by the program (`demo.not_text`).
    pub code: String,
    /// Plain-language sentence, safe to show a customer.
    pub message: String,
}

/// Everything a command can fail with.
///
/// The `Display` text of each variant is the technical detail written to the
/// log. What the user sees comes from [`AppError::user_message`].
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    /// The request reached outside what the app is allowed to touch, such as a
    /// file that was neither picked in a dialog nor dropped on the window.
    #[error("not allowed: {detail}")]
    NotAllowed { detail: String },

    /// A program-specific failure with its own code and message.
    ///
    /// Programs use this rather than adding variants here, so that app/ never
    /// has to edit a chassis file. See [`AppError::program`].
    #[error("{code}: {detail}")]
    Program {
        code: &'static str,
        message: String,
        detail: String,
    },
}

impl AppError {
    /// A failure specific to this program.
    ///
    /// `code` should be namespaced (`"invoices.duplicate"`), `message` is shown
    /// to the user, and `detail` is logged.
    pub fn program(
        code: &'static str,
        message: impl Into<String>,
        detail: impl Into<String>,
    ) -> Self {
        Self::Program {
            code,
            message: message.into(),
            detail: detail.into(),
        }
    }

    pub fn not_allowed(detail: impl Into<String>) -> Self {
        Self::NotAllowed {
            detail: detail.into(),
        }
    }

    /// The stable code. Changing one is a breaking change for the interface.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Io(error) => match error.kind() {
                std::io::ErrorKind::NotFound => "not_found",
                std::io::ErrorKind::PermissionDenied => "permission_denied",
                _ => "io",
            },
            Self::Tauri(_) => "internal",
            Self::NotAllowed { .. } => "not_allowed",
            Self::Program { code, .. } => code,
        }
    }

    /// The sentence a customer sees. Never includes paths or OS error text,
    /// which leak details and mean nothing to the person reading them.
    pub fn user_message(&self) -> String {
        match self {
            Self::Io(error) => match error.kind() {
                std::io::ErrorKind::NotFound => "That file or folder could not be found.",
                std::io::ErrorKind::PermissionDenied => {
                    "Windows did not allow access to that file or folder."
                }
                _ => "Something went wrong while reading or writing a file.",
            }
            .to_owned(),
            Self::Tauri(_) => "Something went wrong inside the app.".to_owned(),
            Self::NotAllowed { .. } => {
                "That location is outside what this app is allowed to access.".to_owned()
            }
            Self::Program { message, .. } => message.clone(),
        }
    }
}

/// `?` on anything that becomes an [`AppError`] produces a [`CommandError`],
/// logging the technical detail on the way through.
impl<E: Into<AppError>> From<E> for CommandError {
    fn from(error: E) -> Self {
        let error = error.into();
        let code = error.code();
        log::error!("command failed [{code}]: {error}");
        Self {
            code: code.to_owned(),
            message: error.user_message(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    #[test]
    fn io_errors_map_to_stable_codes() {
        let cases = [
            (io::ErrorKind::NotFound, "not_found"),
            (io::ErrorKind::PermissionDenied, "permission_denied"),
            (io::ErrorKind::InvalidData, "io"),
        ];
        for (kind, code) in cases {
            let error = CommandError::from(io::Error::new(kind, "C:\\secret\\path.txt"));
            assert_eq!(error.code, code);
        }
    }

    #[test]
    fn user_messages_never_contain_the_technical_detail() {
        let detail = "C:\\Users\\someone\\private.txt: Access is denied. (os error 5)";
        let error = CommandError::from(io::Error::new(io::ErrorKind::PermissionDenied, detail));
        assert!(!error.message.contains("private.txt"));
        assert!(!error.message.contains("os error"));

        let error = CommandError::from(AppError::not_allowed(detail));
        assert_eq!(error.code, "not_allowed");
        assert!(!error.message.contains("private.txt"));
    }

    #[test]
    fn program_errors_keep_their_own_code_and_message() {
        let error = CommandError::from(AppError::program(
            "demo.not_text",
            "That file is not plain text.",
            "invalid utf-8 at byte 12",
        ));
        assert_eq!(
            error,
            CommandError {
                code: "demo.not_text".into(),
                message: "That file is not plain text.".into(),
            }
        );
    }
}
