// use markdown::{self, mdast::Node as MdastNode, message, ParseOptions};
// use std::fmt::{Display, Formatter};
// use std::fs::File;
// use std::io::Read;

// #[derive(Debug)]
// pub enum DdlMdParseError {
//     IoError(std::io::Error),
//     MdrsError(message::Message),
// }

// impl std::error::Error for DdlMdParseError {
//     fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
//         None
//     }
// }

// impl Display for DdlMdParseError {
//     fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
//         match &self {
//             DdlMdParseError::IoError(ref e) => e.fmt(f),
//             DdlMdParseError::MdrsError(ref e) => write!(f, "Markdown parse error: {}", e),
//         }
//     }
// }

// pub fn markdown_parse(file_path: &str) -> Result<MdastNode, DdlMdParseError> {
//     // 打开文件
//     let mut file = File::open(file_path).map_err(DdlMdParseError::IoError)?;
//     // 将文件内容读取到字符串中
//     let mut contents = String::new();
//     file.read_to_string(&mut contents).map_err(DdlMdParseError::IoError)?;

//     // 将Markdown内容解析为AST
//     let ast = markdown::to_mdast(&contents, &ParseOptions::gfm()).map_err(DdlMdParseError::MdrsError)?;

//     // 返回解析后的AST
//     Ok(ast)
// }

// #[cfg(test)]
// mod test {
//     use super::*;
//     #[test]
//     fn test1() {
//         let ast_result = markdown_parse("a.md");
//         // Properly handle the Result before accessing the AstNode
//         match ast_result {
//             Ok(ast) => println!("Root node type: {:?}", ast),
//             Err(e) => println!("Error fn markdown_parse: {}", e),
//         }
//     }
// }
