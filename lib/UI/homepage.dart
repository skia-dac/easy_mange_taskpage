import 'package:date_picker_timeline/date_picker_timeline.dart';
import 'package:easypage/UI/services/notification_services.dart';
import 'package:easypage/UI/services/theme_services.dart';
import 'package:easypage/UI/theme.dart';
import 'package:easypage/controllers/task_controller.dart';
import 'package:easypage/models/task.dart';
import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:get/get.dart';
import 'package:get/get_core/src/get_main.dart';
import 'package:get/get_navigation/src/extension_navigation.dart';
import 'package:get/get_utils/src/extensions/context_extensions.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import './widgets/button.dart';
import 'add_task_bar.dart';
import 'widgets/task_tile.dart';

class HomePage extends StatefulWidget {
  const HomePage({Key? key}) : super(key: key);

  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  DateTime _selectedDate = DateTime.now();
  final _taskController = Get.put(TaskController());
  var notifyHelper;

  @override
  void initState() {
    // TODO: implement initState
    super.initState();
    notifyHelper = NotifyHelper();
    notifyHelper.initializeNotification();
    notifyHelper.requestIOSPermissions();
    setState(() {
      print("I am here");
    });
  }

  @override
  Widget build(BuildContext context) {
    print("build method called");
    return Scaffold(
      appBar: _appBar(),
      // to call teh background color
      backgroundColor: context.theme.backgroundColor,
      body: Column(
        children: [
          _addTaskBar(),
          _addDateBar(),
          SizedBox(height: 10,),
          _showTasks(),
        ],
      ),
    );
  }

  _showTasks() {
    return Expanded(
      child: Obx(() {
        return ListView.builder(
            itemCount: _taskController.taskList.length,

            itemBuilder: (_, index) {
              print(_taskController.taskList.length);

              Task task = _taskController.taskList[index];
               print(task.toJson());
              if(task.repeat=='Daily'){
                return AnimationConfiguration.staggeredList(
                    position: index,
                    child: SlideAnimation(
                      child:
                      FadeInAnimation(
                        child: Row(
                          children: [
                            GestureDetector(
                                onTap: () {
                                  _showBottomSheet(
                                      context, task);
                                },
                                child: TaskTile(task)
                            ),
                          ],
                        ),
                      ),

                    ));
              }
              if (task.date==DateFormat.yMEd().format(_selectedDate)){
                return AnimationConfiguration.staggeredList(
                    position: index,
                    child: SlideAnimation(
                      child:
                      FadeInAnimation(
                        child: Row(
                          children: [
                            GestureDetector(
                                onTap: () {
                                  _showBottomSheet(
                                      context, task);
                                },
                                child: TaskTile(task)
                            ),
                          ],
                        ),
                      ),

                    ));

              }
              else{
              return Container();
              }




            });
      }),
    );
  }

  _showBottomSheet(BuildContext context, Task task) {
    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.only(top: 4),
        height: task.isCompleted == 1?
        MediaQuery.of(context).size.height * 0.24:
        MediaQuery.of(context).size.height * 0.32,
        color: Get.isDarkMode ? darkGreyClr : Colors.white,
        child: Column(
          children: [
            Container(
              height: 6,
              width: 120,
              decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: Get.isDarkMode ? Colors.grey[600] : Colors.grey[300]
              ),
            ),
            Spacer(),
            task.isCompleted==1
            ?Container()
                : _bottonSheetButton(
              label: "Task completed",
                onTap: (){
                _taskController.markTaskCompleted(task.id!);
                  Get.back();
                  },
                clr: primaryClr,
            context:context,
            ),
             SizedBox(
              height:2,
            ),
            _bottonSheetButton(label: "Delete Task",
              onTap: (){
              _taskController.delete(task);
              _taskController.getTasks();
              Get.back();},
              clr: Colors.red[300]!,
              context:context,),
            SizedBox(
              height:20,
            ),
            _bottonSheetButton(label: "Close",
              onTap: (){ Get.back();},
              clr: Colors.green,
              isClose:true,
              context:context,),
            SizedBox(height: 10,),
          ],
        ),
      ),
    );
  }

  _bottonSheetButton({
    required String label,
    required Function()? onTap,
    required Color clr,
    bool isClose=false,
    required BuildContext context,
  }){
    return GestureDetector(
      onTap:onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        height: 55,
        width: MediaQuery.of(context).size.width*0.9,

        decoration: BoxDecoration(
          border: Border.all(
            width:2,
            color:isClose==true?Get.isDarkMode?Colors.grey[600]!:Colors.grey[300]!:clr
          ),
          borderRadius: BorderRadius.circular(20),
          color: isClose==true?Colors.transparent:clr,
        ),
        child:Center(
        child: Text(
          label,
          style: isClose?titleStyle:titleStyle.copyWith(color: Colors.white),
        ),)
      ),
    );
}
  _addDateBar(){
    return Container(
        margin: const EdgeInsets.only(top:20, left: 10),

        child:DatePicker(
          DateTime.now(),
          width: 80,
          height:100,
          initialSelectedDate: DateTime.now(),
          selectedTextColor:primaryClr,
          selectionColor: Colors.orange,
          dateTextStyle: GoogleFonts.lato(
            textStyle:const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color:Colors.grey
            ),
          ),
          dayTextStyle: GoogleFonts.lato(
            textStyle:const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color:Colors.grey
            ),
          ),
          monthTextStyle: GoogleFonts.lato(
            textStyle:const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color:Colors.grey
            ),
          ),
          onDateChange: (date){
            setState(() {

            });
            _selectedDate=date;

          },

        )
    ) ;
  }
_addTaskBar(){
    return
  Container(
      margin: const EdgeInsets.only(left: 20 , right: 20 , top: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            child: Column (
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text (DateFormat.yMMMMd().format(DateTime.now()),
                  style:subHeadingStyle,
                ),
                Text("Today",
                    style:headingStyle)

              ],
            ),
          ),
          Container (
              child: Align(
                alignment: Alignment.center,
                child: MyButton(label:"+ Add a task",
                    onTap: ()async{
                  await  Get.to( AddTaskPage());
                  _taskController.getTasks();
                }
                ),
              )
          )
        ],

      )
  );

}
  _appBar() {
    return AppBar(
      elevation: 0,
      backgroundColor: context.theme.backgroundColor,
      leading: GestureDetector(
        onTap: (){
          ThemeService().SwitchTheme();
          notifyHelper.displayNotification(
            title: "Theme Changed",
            body: Get.isDarkMode? "Activated Light Theme":" Activated Dark Theme "
          );

        notifyHelper.scheduledNotification();

        },
        child:Icon(Get.isDarkMode? Icons.wb_sunny_outlined:Icons.nightlight_round , size: 20,
          color: Get.isDarkMode? Colors.white:Colors.black
        ),
      ),
          // actions: const [
          //   CircleAvatar(
          //     backgroundImage:  AssetImage(
          //       "assets/images/ii.jpg"
          //     ),
          //   ),/*
          //  Icon(Icons.person, size: 20, ), */
          //   SizedBox(width: 10,),
          //
          // ],
    );
  }


}



