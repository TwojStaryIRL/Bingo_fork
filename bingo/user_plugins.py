# bingo/user_plugins.py - tu są user specific funkcje, żeby nie rozwalać struktury views, i 
                        # żeby to gdzieś trzyamć w jednym miejscu, inaczej byłoby po prostu wrzucone 200 linijek nagle z 50 if-ami

from django.templatetags.static import static
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class UserPluginConfig:
    js_plugin: Optional[str]
    sfx: Dict[str, List[str]]

#
def testinguser1_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/testinguser1.js",
        sfx={
            "hide": [
                static("bingo/sfx/twitch_on_hide_1.mp3"),
                static("bingo/sfx/twitch_on_hide_2.mp3"),
            ],
            "reveal": [
                static("bingo/sfx/twitch_on_reveal_1.mp3"),
                static("bingo/sfx/twitch_on_reveal_2.mp3"),
            ],
        }
    )


USER_PLUGIN_REGISTRY = {
    "testinguser1": testinguser1_func,
    #
}

def get_user_plugin(username: str) -> Optional[UserPluginConfig]:
    func = USER_PLUGIN_REGISTRY.get(username)
    if not func:
        return None
    return func()
