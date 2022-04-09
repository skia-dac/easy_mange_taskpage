import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:babstrap_settings_screen/babstrap_settings_screen.dart';
import 'package:wiredash/wiredash.dart';

import 'about.dart';



class Setting extends StatelessWidget {
  const Setting({Key ?key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.white.withOpacity(.94),

        body:
        Padding(
          padding: const EdgeInsets.all(10),
          child: ListView(
            children: [
              // user card
              // SimpleUserCard(
              //   userName: "User name",
              //   userProfilePic: AssetImage(
              //     "assets/images/ii.jpg",)
              // ),
              SettingsGroup(
                items: [
                  SettingsItem(
                    onTap: () {

                    },
                    icons: CupertinoIcons.profile_circled,
                    iconStyle: IconStyle(),
                    title: 'Profit',
                    subtitle: "Modification",
                  ),
        SettingsItem(
          onTap: () {},
          icons: Icons.dark_mode_rounded,
          iconStyle: IconStyle(
            iconsColor: Colors.white,
            withBackground: true,
            backgroundColor: Colors.black,
          ),
          title: 'Dark mode',
          subtitle: "Automatic",
          trailing: Switch.adaptive(
            value: false,
            onChanged: (value) {},
          ),
        ),


                  SettingsItem(
                    onTap : () => Wiredash.of(context)?.show(),
                    //     Navigator.push(context,
                    //         MaterialPageRoute(builder: (context) =>MyNevBar ())),


                    icons: Icons.feedback,
                    iconStyle: IconStyle(
                      iconsColor: Colors.white,
                      withBackground: true,
                      backgroundColor: Colors.red,
                    ),
                    title: 'Feedback',
                    subtitle: "Report a Bug ,Request a Feature ",

                  ),
                  SettingsItem(
                    onTap: ()=> Navigator.push(context,
                        MaterialPageRoute(builder: (context) =>ProfileWidget ())),
                    icons: Icons.info_rounded,
                    iconStyle: IconStyle(
                      backgroundColor: Colors.purple,
                    ),
                    title: 'About',
                    subtitle: "Easy Manage",
                  ),
                ],
              ),
              // You can add a settings title

              SettingsGroup(
                settingsGroupTitle: "Account",
                items: [
                  SettingsItem(
                    onTap: () {},
                    icons: Icons.exit_to_app_rounded,
                    title: "Sign Out",
                  ),

                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}