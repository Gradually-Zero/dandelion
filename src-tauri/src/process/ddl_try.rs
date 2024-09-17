use markdown::{self, ParseOptions};
use serde::Serialize;
use serde_json;
use std::fs::File;
use std::io::Read;
use tauri::{command, AppHandle};

use crate::process::ddl_conf::DdlConf;

#[command]
pub fn get_markdown_ast(app: AppHandle, file_path: String) -> Result<String, MarkdownParseError> {
    let path = DdlConf::get_conf_path(&app);
    println!("{:?}", path);
    parse_markdown(&file_path)
}

#[derive(Debug, Serialize)]
pub struct MarkdownParseError {
    message: String,
}

pub fn parse_markdown(file_path: &str) -> Result<String, MarkdownParseError> {
    // 打开文件
    let mut file = File::open(file_path).map_err(|e| MarkdownParseError { message: e.to_string() })?;

    // 读取文件内容
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| MarkdownParseError { message: e.to_string() })?;

    // 解析 Markdown 内容
    let ast = markdown::to_mdast(&contents, &ParseOptions::gfm()).map_err(|e| MarkdownParseError { message: e.to_string() })?;

    // 将 AST 序列化为 JSON
    let json = serde_json::to_string(&ast).map_err(|e| MarkdownParseError { message: e.to_string() })?;

    Ok(json)
}
