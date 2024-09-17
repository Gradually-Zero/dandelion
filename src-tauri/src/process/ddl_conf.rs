use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug)]
pub struct DdlConf {}

impl DdlConf {
    pub fn get_conf_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let config_dir = app.path().config_dir()?.join("dandelion").join("config.json");
        Ok(config_dir)
    }
}
