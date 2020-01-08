import * as OS from "os";
import * as Git from "nodegit";
import * as fetch from "node-fetch";

require('dotenv').config();

async function main() {
    const repo = await Git.Repository.open(`${process.env.REPO}`);
    console.log('Fetching and pruning remotes..');
    try {
        await repo.fetchAll({
            prune: true,
            callbacks: {
                credentials: (url, username) => {
                    if (process.env.SSH_USE_AGENT === 'true') {
                        return Git.Cred.sshKeyFromAgent(username);
                    }
                    return Git.Cred.sshKeyNew(
                        username,
                        process.env.SSH_KEY_PUBLIC || OS.homedir() + `\\.ssh\\id_rsa.pub`,
                        process.env.SSH_KEY_PRIVATE || OS.homedir() + `\\.ssh\\id_rsa`,
                        "",
                    );
                }
            }
        });
    } catch (error) {
        console.error(`Could not fetch from remotes!`);
    }

    console.log('Done.');

    console.log('Getting IDs and TP status..');
    const references = await Git.Reference.list(repo);
    const branches = references.filter(ref => ref.includes('#'));
    const miscBranches = references.filter(ref => !ref.includes('#')).filter(ref => ref.includes('refs/heads/'));
    const ids = branches.map(ref => ref.match(`#(\\d+)`)[1]);
    // console.log(ids);

    var url = `https://${process.env.TP_DOMAIN}.tpondemand.com/api/v2/Assignable/?where=id in [${ids.join(',')}]&select={id,name,EntityState.isFinal,EntityState.name as state,name,EntityType.name as type}&take=1000&format=json&token=${process.env.TP_TOKEN}`;

    try {
        const raw = await fetch(url);
        const response = await raw.json();

        const itemsDone = response.items.filter(item => item.isFinal);
        const itemsNotDone = response.items.filter(item => !item.isFinal);

        console.log('------------------------');
        console.log('These branches are still relevant:');
        itemsNotDone.forEach(item => console.log(`#${item.id} [${item.state}] - ${item.name}`));

        const result = branches.filter(ref => {
            return itemsDone.some(item => ref.includes(`#${item.id}`));
        });
        // console.log(response.items);
        // console.log(itemsNotDone);
        // console.log(itemsDone);
        // console.log(branches);
        // console.log(result);

        console.log('------------------------');
        console.log('These branches are no longer relevant and to be removed:');
        result.filter(ref => ref.startsWith('refs/heads/')).map(ref => {
            console.log(`Removing '${ref}'`);
            const code = Git.Reference.remove(repo, ref);
            if (code !== 0) {
                console.error(`Error removing '${ref}'`);
            }
        });

        console.log('------------------------');
        console.log('Please remove these branches from your remotes:');
        result.filter(ref => ref.startsWith('refs/remotes/')).map(ref => {
            console.log(ref.slice('refs/remotes/'.length));
        });

        
        console.log('------------------------');
        console.log('These branches are not matched to anything on target process:');
        miscBranches.forEach(ref => console.log(ref));
    } catch (e) {
        console.log(e);
        return 1;
    }
}
main();
