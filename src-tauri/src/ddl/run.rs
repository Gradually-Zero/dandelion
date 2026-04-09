use markdown::{self, ParseOptions};
use serde::Serialize;
use serde_json;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use tauri::{command, AppHandle};

use crate::ddl::conf::{ConfigError, DdlConf};

#[command]
pub fn get_selected_file(app: AppHandle) -> Result<String, ConfigError> {
    DdlConf::get_selected_file_path(&app)
}

#[command]
pub fn get_editor_word_wrap(app: AppHandle) -> Result<String, ConfigError> {
    DdlConf::get_editor_word_wrap(&app)
}

#[command]
pub fn get_editor_theme(app: AppHandle) -> Result<String, ConfigError> {
    DdlConf::get_editor_theme(&app)
}

#[command]
pub fn set_selected_file(app: AppHandle, file_path: String) -> Result<(), ConfigError> {
    let conf = DdlConf::load(&app)?;
    conf.amend(serde_json::json!({"selected_file_path": file_path}))
        ?
        .save(&app)
        ?;
    Ok(())
}

#[command]
pub fn set_editor_word_wrap(app: AppHandle, word_wrap: String) -> Result<(), ConfigError> {
    let normalized_word_wrap = if word_wrap == "off" { "off" } else { "on" };
    let conf = DdlConf::load(&app)?;
    conf.amend(serde_json::json!({"editor_word_wrap": normalized_word_wrap}))
        ?
        .save(&app)
        ?;
    Ok(())
}

#[command]
pub fn set_editor_theme(app: AppHandle, theme: String) -> Result<(), ConfigError> {
    let normalized_theme = if theme == "vs" || theme == "vscode-dark-plus" {
        theme.as_str()
    } else {
        "vs"
    };
    let conf = DdlConf::load(&app)?;
    conf.amend(serde_json::json!({"editor_theme": normalized_theme}))
        ?
        .save(&app)
        ?;
    Ok(())
}

#[command]
pub fn get_markdown_ast(app: AppHandle) -> Result<String, MarkdownParseError> {
    let selected_file_path = DdlConf::get_selected_file_path(&app).map_err(|e| MarkdownParseError {
        message: e.message,
    })?;
    if selected_file_path.is_empty() {
        return Err(MarkdownParseError {
            message: "selected file path is null".to_string(),
        });
    }
    parse_markdown(&selected_file_path)
}

#[command]
pub fn read_selected_file_content(app: AppHandle) -> Result<String, FileIoError> {
    let selected_file_path = get_selected_file_path(&app)?;
    fs::read_to_string(&selected_file_path).map_err(|e| FileIoError {
        message: format!("failed to read file '{}': {}", selected_file_path, e),
    })
}

#[command]
pub fn write_selected_file_content(app: AppHandle, content: String) -> Result<(), FileIoError> {
    let selected_file_path = get_selected_file_path(&app)?;
    fs::write(&selected_file_path, content).map_err(|e| FileIoError {
        message: format!("failed to write file '{}': {}", selected_file_path, e),
    })
}

#[derive(Debug, Serialize)]
pub struct MarkdownParseError {
    message: String,
}

#[derive(Debug, Serialize)]
pub struct FileIoError {
    message: String,
}

fn get_selected_file_path(app: &AppHandle) -> Result<String, FileIoError> {
    let selected_file_path = DdlConf::get_selected_file_path(app).map_err(|e| FileIoError {
        message: e.message,
    })?;

    if selected_file_path.is_empty() {
        return Err(FileIoError {
            message: "selected file path is null".to_string(),
        });
    }

    if !Path::new(&selected_file_path).exists() {
        return Err(FileIoError {
            message: format!("selected file does not exist: {}", selected_file_path),
        });
    }

    Ok(selected_file_path)
}

pub fn parse_markdown(file_path: &str) -> Result<String, MarkdownParseError> {
    // 打开文件
    let mut file = File::open(file_path).map_err(|e| MarkdownParseError {
        message: e.to_string(),
    })?;

    // 读取文件内容
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| MarkdownParseError {
            message: e.to_string(),
        })?;

    // 解析 Markdown 内容
    let ast =
        markdown::to_mdast(&contents, &ParseOptions::gfm()).map_err(|e| MarkdownParseError {
            message: e.to_string(),
        })?;

    // 将 AST 序列化为 JSON
    let json = serde_json::to_string(&ast).map_err(|e| MarkdownParseError {
        message: e.to_string(),
    })?;

    Ok(json)
}
