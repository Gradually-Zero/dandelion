use crate::ddl::notify::notify_selected_change;
use log::error;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::Display;
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Serialize, Deserialize, Debug)]
pub struct DdlConf {
    pub selected_file_path: String,
    pub editor_word_wrap: String,
    pub editor_theme: String,
    pub window_x: Option<f64>,
    pub window_y: Option<f64>,
    pub window_width: Option<f64>,
    pub window_height: Option<f64>,
    pub window_maximized: bool,
}

#[derive(Debug, Serialize)]
pub struct ConfigError {
    pub message: String,
}

impl DdlConf {
    pub fn get_conf_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, ConfigError> {
        let config_dir = app
            .path()
            .config_dir()
            .map_err(ConfigError::from_display)?
            .join("dandelion")
            .join("config.json");
        Ok(config_dir)
    }

    pub fn new() -> Self {
        Self {
            selected_file_path: "".to_string(),
            editor_word_wrap: "on".to_string(),
            editor_theme: "vs".to_string(),
            window_x: None,
            window_y: None,
            window_width: None,
            window_height: None,
            window_maximized: false,
        }
    }

    pub fn save<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), ConfigError> {
        self.save_internal(app, true)
    }

    pub fn save_silent<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), ConfigError> {
        self.save_internal(app, false)
    }

    fn save_internal<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        notify_selected: bool,
    ) -> Result<(), ConfigError> {
        let path = Self::get_conf_path(app)?;

        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(ConfigError::from_display)?;
        }

        let mut file = File::create(path).map_err(ConfigError::from_display)?;
        let contents = serde_json::to_string_pretty(self).map_err(ConfigError::from_display)?;
        // dbg!(&contents);
        file.write_all(contents.as_bytes())
            .map_err(ConfigError::from_display)?;
        if notify_selected {
            notify_selected_change(app, self.selected_file_path.to_string())
                .map_err(ConfigError::from_display)?;
        }
        Ok(())
    }

    /** 修改 */
    pub fn amend(self, json: Value) -> Result<Self, ConfigError> {
        let val = serde_json::to_value(self).map_err(ConfigError::from_display)?;
        let mut config: BTreeMap<String, Value> =
            serde_json::from_value(val).map_err(ConfigError::from_display)?;
        let new_json: BTreeMap<String, Value> =
            serde_json::from_value(json).map_err(ConfigError::from_display)?;

        for (k, v) in new_json {
            config.insert(k, v);
        }

        let config_str =
            serde_json::to_string_pretty(&config).map_err(ConfigError::from_display)?;
        serde_json::from_str::<DdlConf>(&config_str).map_err(|err| {
            error!("[ddl_conf::amend] {}", err);
            ConfigError::from_display(err)
        })
    }

    pub fn load<R: Runtime>(app: &AppHandle<R>) -> Result<Self, ConfigError> {
        let path = Self::get_conf_path(app)?;

        if !path.exists() {
            let config = Self::new();
            config.save(app)?;
            return Ok(config);
        }

        let mut file = File::open(path).map_err(ConfigError::from_display)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(ConfigError::from_display)?;
        let config: Result<DdlConf, _> = serde_json::from_str(&contents);

        // 处理缺失字段的兼容情况，并在需要时回退到默认值
        if let Err(e) = &config {
            error!("[ddl_conf::load] {}", e);
            let mut default_config = Self::new();
            let raw_contents =
                serde_json::from_str(&contents).map_err(ConfigError::from_display)?;
            default_config = default_config.amend(raw_contents)?;
            default_config.save(app)?;
            return Ok(default_config);
        }

        config.map_err(ConfigError::from_display)
    }

    pub fn get_selected_file_path<R: Runtime>(app: &AppHandle<R>) -> Result<String, ConfigError> {
        Ok(Self::load(app)?.selected_file_path)
    }

    pub fn get_editor_word_wrap<R: Runtime>(app: &AppHandle<R>) -> Result<String, ConfigError> {
        let editor_word_wrap = Self::load(app)?.editor_word_wrap;

        if editor_word_wrap == "off" {
            return Ok(editor_word_wrap);
        }

        Ok("on".to_string())
    }

    pub fn get_editor_theme<R: Runtime>(app: &AppHandle<R>) -> Result<String, ConfigError> {
        let editor_theme = Self::load(app)?.editor_theme;

        if editor_theme == "vs" || editor_theme == "vscode-dark-plus" {
            return Ok(editor_theme);
        }

        Ok("vs".to_string())
    }
}

impl ConfigError {
    pub(crate) fn from_display(error: impl Display) -> Self {
        Self {
            message: error.to_string(),
        }
    }
}

impl Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for ConfigError {}
