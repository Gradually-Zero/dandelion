use crate::ddl::notify::notify_selected_change;
use log::error;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug)]
pub struct DdlConf {
    pub selected_file_path: String,
}

impl DdlConf {
    pub fn get_conf_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let config_dir = app.path().config_dir()?.join("dandelion").join("config.json");
        Ok(config_dir)
    }

    pub fn new() -> Self {
        Self {
            selected_file_path: "".to_string(),
        }
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        let path = Self::get_conf_path(app)?;

        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }

        let mut file = File::create(path)?;
        let contents = serde_json::to_string_pretty(self)?;
        // dbg!(&contents);
        file.write_all(contents.as_bytes())?;
        notify_selected_change(app, self.selected_file_path.to_string());
        Ok(())
    }

    /** 修改 */
    pub fn amend(self, json: Value) -> Result<Self, serde_json::Error> {
        let val = serde_json::to_value(self)?;
        let mut config: BTreeMap<String, Value> = serde_json::from_value(val)?;
        let new_json: BTreeMap<String, Value> = serde_json::from_value(json)?;

        for (k, v) in new_json {
            config.insert(k, v);
        }

        let config_str = serde_json::to_string_pretty(&config)?;
        serde_json::from_str::<DdlConf>(&config_str).map_err(|err| {
            error!("[ddl_conf::amend] {}", err);
            err
        })
    }

    pub fn load(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let path = Self::get_conf_path(app)?;

        if !path.exists() {
            let config = Self::new();
            config.save(app)?;
            return Ok(config);
        }

        let mut file = File::open(path)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
        let config: Result<DdlConf, _> = serde_json::from_str(&contents);

        // Handle conditional fields and fallback to defaults if necessary
        if let Err(e) = &config {
            error!("[ddl_conf::load] {}", e);
            let mut default_config = Self::new();
            default_config = default_config.amend(serde_json::from_str(&contents)?)?;
            default_config.save(app)?;
            return Ok(default_config);
        }

        Ok(config?)
    }

    pub fn get_selected_file_path(app: &AppHandle) -> String {
        let selected_file_path = Self::load(app).unwrap().selected_file_path;
        return selected_file_path;
    }
}
